import { useState, type ReactNode } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Grid3X3, Layers, LayoutList } from "lucide-react-native";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type LayoutMode = "stack" | "grid" | "list";

export interface CardData {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  imageUrl?: string;
  color?: string;
}

export interface MorphingCardStackProps {
  cards?: CardData[];
  className?: string;
  defaultLayout?: LayoutMode;
  fullscreen?: boolean;
  onCardClick?: (card: CardData) => void;
}

const SWIPE_THRESHOLD = 50;

/**
 * React Native adaptation of the Morphing Card Stack
 * using react-native-reanimated and react-native-gesture-handler
 */
export function Component({
  cards = [],
  className,
  defaultLayout = "stack",
  fullscreen = false,
  onCardClick,
}: MorphingCardStackProps) {
  const { width, height } = useWindowDimensions();
  const [layout, setLayout] = useState<LayoutMode>(defaultLayout);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!cards || cards.length === 0) {
    return null;
  }

  const handleSwipeLeft = () => {
    setActiveIndex((prev) => (prev + 1) % cards.length);
  };

  const handleSwipeRight = () => {
    setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const getStackOrder = () => {
    const reordered = [];
    for (let i = 0; i < cards.length; i++) {
      const index = (activeIndex + i) % cards.length;
      reordered.push({ ...cards[index], stackPosition: i });
    }
    return reordered.reverse();
  };

  const displayCards =
    layout === "stack" ? getStackOrder() : cards.map((c, i) => ({ ...c, stackPosition: i }));

  const stackSize = fullscreen
    ? Math.max(300, Math.min(width - 28, height * 0.68))
    : 300;
  const stackCardSize = fullscreen
    ? Math.max(250, Math.min(stackSize - 34, 420))
    : 256;

  return (
    <View className={cn("gap-4", className)}>
      {/* Layout Toggle */}
      <View className="flex-row items-center justify-center gap-1 rounded-lg bg-slate-200/50 p-1 mx-auto self-center">
        <Pressable
          onPress={() => setLayout("stack")}
          className={cn(
            "rounded-md p-2 transition-all",
            layout === "stack" ? "bg-black" : "bg-transparent"
          )}
        >
          <Layers className="h-4 w-4" color={layout === "stack" ? "white" : "gray"} />
        </Pressable>
        <Pressable
          onPress={() => setLayout("grid")}
          className={cn(
            "rounded-md p-2 transition-all",
            layout === "grid" ? "bg-black" : "bg-transparent"
          )}
        >
          <Grid3X3 className="h-4 w-4" color={layout === "grid" ? "white" : "gray"} />
        </Pressable>
        <Pressable
          onPress={() => setLayout("list")}
          className={cn(
            "rounded-md p-2 transition-all",
            layout === "list" ? "bg-black" : "bg-transparent"
          )}
        >
          <LayoutList className="h-4 w-4" color={layout === "list" ? "white" : "gray"} />
        </Pressable>
      </View>

      {/* Cards Container */}
      <View
        style={layout === "stack" ? { height: stackSize + 24, width: stackSize + 24 } : undefined}
        className={cn(
          "mx-auto items-center justify-center",
          layout === "grid" && "flex-row flex-wrap w-full px-2 justify-between",
          layout === "list" && "flex-col w-full px-2 gap-3"
        )}
      >
        {displayCards.map((card) => {
          const isExpanded = expandedCard === card.id;
          const isTopCard = layout === "stack" && card.stackPosition === 0;

          return (
            <AnimatedCard
              key={card.id}
              card={card}
              layout={layout}
              isExpanded={isExpanded}
              isTopCard={isTopCard}
              onCardClick={() => {
                setExpandedCard(isExpanded ? null : card.id);
                onCardClick?.(card);
              }}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              totalCards={cards.length}
              stackCardSize={stackCardSize}
            />
          );
        })}
      </View>

      {layout === "stack" && cards.length > 1 && (
        <View className="flex-row justify-center gap-1.5 mt-4">
          {cards.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => setActiveIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex ? "w-4 bg-black" : "w-1.5 bg-gray-300"
              )}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function AnimatedCard({
  card,
  layout,
  isExpanded,
  isTopCard,
  onCardClick,
  onSwipeLeft,
  onSwipeRight,
  totalCards,
  stackCardSize,
}: {
  card: CardData & { stackPosition: number };
  layout: LayoutMode;
  isExpanded: boolean;
  isTopCard: boolean;
  onCardClick: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  totalCards: number;
  stackCardSize: number;
}) {
  const panX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((e) => {
      panX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD || e.velocityX < -1000) {
        runOnJS(onSwipeLeft)();
      } else if (e.translationX > SWIPE_THRESHOLD || e.velocityX > 1000) {
        runOnJS(onSwipeRight)();
      }
      panX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (layout === "stack") {
      return {
        position: "absolute",
        top: withSpring(card.stackPosition * 10),
        left: withSpring(card.stackPosition * 10),
        zIndex: totalCards - card.stackPosition,
        transform: [
          { translateX: panX.value },
          { rotate: withSpring(`${(card.stackPosition - 1) * 2}deg`) },
          { scale: withSpring(isExpanded ? 1.05 : 1) },
        ],
      };
    } else if (layout === "grid") {
      return {
        position: "relative",
        width: "49%",
        aspectRatio: 1,
        marginBottom: 10,
        transform: [{ scale: withSpring(isExpanded ? 1.05 : 1) }, { rotate: "0deg" }],
        top: withTiming(0),
        left: withTiming(0),
      };
    } else {
      return {
        position: "relative",
        width: "100%",
        marginBottom: 10,
        transform: [{ scale: withSpring(isExpanded ? 1.05 : 1) }, { rotate: "0deg" }],
        top: withTiming(0),
        left: withTiming(0),
      };
    }
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          animatedStyle,
          { backgroundColor: card.color || "#fff" },
          layout === "stack" ? { width: stackCardSize, height: stackCardSize } : undefined,
        ]}
        className={cn(
          "rounded-2xl border border-white/10 overflow-hidden",
          layout === "grid" && "min-h-[210px]",
          layout === "list" && "min-h-[140px]",
          isExpanded && "border-blue-400"
        )}
      >
        <Pressable onPress={onCardClick} className="flex-1 bg-[#111827]">
          {card.imageUrl ? (
            <Image
              source={{ uri: card.imageUrl }}
              style={{ width: "100%", height: layout === "list" ? 80 : 130 }}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <View className="w-full h-[96px] items-center justify-center bg-slate-800">
              {card.icon}
            </View>
          )}

          <View className="p-3">
            <Text className="font-semibold text-white" numberOfLines={1}>
              {card.title}
            </Text>
            <Text
              className="text-sm text-slate-300 mt-1"
              numberOfLines={layout === "stack" ? 3 : layout === "grid" ? 2 : 1}
            >
              {card.description}
            </Text>
          </View>

          {isTopCard && (
            <View className="absolute bottom-2 left-0 right-0 items-center">
              <Text className="text-xs text-slate-300">Swipe to navigate</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
