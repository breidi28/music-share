const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const componentMappings = [
    [new RegExp("import \\{ Box \\}.*;", "g"), "import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, FlatList, Image } from 'react-native';\nimport { SafeAreaView } from 'react-native-safe-area-context';"],
    [new RegExp("import \\{ Text \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ Heading \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ Input,.*?\\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ Button,.*?\\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ VStack \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ HStack \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ Pressable \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ Center \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ Spinner \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{ Image \\} from '@\\/components.*?;", "g"), ''],
    [new RegExp("import \\{.*?\\} from '@\\/components\\/ui.*?;", "g"), ''],
    [new RegExp("<Box", "g"), '<View'],
    [new RegExp("<\\/Box>", "g"), '</View>'],
    [new RegExp("<Center", "g"), '<View className="justify-center items-center" '],
    [new RegExp("<\\/Center>", "g"), '</View>'],
    [new RegExp("<VStack space=\"xs\"", "g"), '<View className="flex-col gap-1" '],
    [new RegExp("<VStack space=\"sm\"", "g"), '<View className="flex-col gap-2" '],
    [new RegExp("<VStack space=\"md\"", "g"), '<View className="flex-col gap-4" '],
    [new RegExp("<VStack space=\"lg\"", "g"), '<View className="flex-col gap-6" '],
    [new RegExp("<VStack space=\"xl\"", "g"), '<View className="flex-col gap-8" '],
    [new RegExp("<VStack", "g"), '<View className="flex-col" '],
    [new RegExp("<\\/VStack>", "g"), '</View>'],
    [new RegExp("<HStack space=\"xs\"", "g"), '<View className="flex-row gap-1" '],
    [new RegExp("<HStack space=\"sm\"", "g"), '<View className="flex-row gap-2" '],
    [new RegExp("<HStack space=\"md\"", "g"), '<View className="flex-row gap-4" '],
    [new RegExp("<HStack space=\"lg\"", "g"), '<View className="flex-row gap-6" '],
    [new RegExp("<HStack space=\"xl\"", "g"), '<View className="flex-row gap-8" '],
    [new RegExp("<HStack", "g"), '<View className="flex-row" '],
    [new RegExp("<\\/HStack>", "g"), '</View>'],
    [new RegExp("<Heading([^>]*)>", "g"), '<Text className="font-bold text-3xl" $1>'],
    [new RegExp("<\\/Heading>", "g"), '</Text>'],
    [new RegExp("<Pressable", "g"), '<TouchableOpacity'],
    [new RegExp("<\\/Pressable>", "g"), '</TouchableOpacity>'],
    [new RegExp("<ButtonSpinner \\/>", "g"), '<ActivityIndicator color="white" />'],
    [new RegExp("<ButtonText([^>]*)>([^<]*)<\\/ButtonText>", "g"), '<Text className="text-white font-semibold text-lg" $1>$2</Text>'],
    [new RegExp("<Button([^>]*)>", "g"), '<TouchableOpacity className="bg-blue-600 rounded-full h-12 flex-row justify-center items-center" $1>'],
    [new RegExp("<\\/Button>", "g"), '</TouchableOpacity>'],
    [new RegExp("<Input([^>]*)>", "g"), '<View className="flex-row items-center border border-gray-700 rounded-lg h-12 bg-neutral-900 px-3" $1>'],
    [new RegExp("<\\/Input>", "g"), '</View>'],
    [new RegExp("<InputField", "g"), '<TextInput className="flex-1 text-white text-base" placeholderTextColor="#9CA3AF" '],
    [new RegExp("<\\/InputField>", "g"), ''],
    [new RegExp("<InputSlot", "g"), '<TouchableOpacity className="justify-center items-center px-1" '],
    [new RegExp("<\\/InputSlot>", "g"), '</TouchableOpacity>'],
    [new RegExp("<Image", "g"), '<Image '],
    [new RegExp("<Spinner([^>]*)>", "g"), '<ActivityIndicator $1/>'],
    ['text-typography-950', 'text-white'],
    ['text-typography-900', 'text-gray-100'],
    ['text-typography-800', 'text-gray-200'],
    ['text-typography-700', 'text-gray-300'],
    ['text-typography-600', 'text-gray-400'],
    ['text-typography-500', 'text-gray-400'],
    ['text-typography-400', 'text-gray-500'],
    ['text-typography-300', 'text-gray-600'],
    ['text-typography-200', 'text-gray-700'],
    ['text-typography-100', 'text-gray-800'],
    ['text-typography-50', 'text-gray-900'],
    ['text-typography-0', 'text-black'],
    ['bg-background-0', 'bg-black'],
    ['bg-background-50', 'bg-neutral-900'],
    ['bg-background-100', 'bg-neutral-800'],
    ['bg-background-200', 'bg-neutral-700'],
    ['primary-500', 'blue-600'],
    ['primary-400', 'blue-500'],
    ['primary-300', 'blue-400'],
    ['secondary-500', 'fuchsia-500'],
    ['outline-100', 'gray-800'],
    ['outline-200', 'gray-700'],
    ['outline-300', 'gray-600'],
    ['outline-400', 'gray-500'],
    [new RegExp('border-outline', 'g'), 'border-gray'],
    [new RegExp('bg-primary', 'g'), 'bg-blue'],
    [new RegExp('text-primary', 'g'), 'text-blue'],
    [new RegExp("space=\"[a-z]+\"", "g"), '']
];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            let modified = false;
            for (const [pattern, replacement] of componentMappings) {
                if (pattern instanceof RegExp) {
                    if (pattern.test(content)) {
                        content = content.replace(pattern, replacement);
                        modified = true;
                    }
                } else {
                    if (content.includes(pattern)) {
                        content = content.split(pattern).join(replacement);
                        modified = true;
                    }
                }
            }
            if (modified) {
                content = content.replace(/className="([^"]+)"\s+className="([^"]+)"/g, 'className="$1 $2"');
                fs.writeFileSync(fullPath, content);
                console.log(`Refactored ${fullPath}`);
            }
        }
    }
}

walk(srcDir);

// App.tsx
let appContent = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf8');
appContent = appContent.replace(/import \{ GluestackUIProvider \} from '@\\/components\\/ui\\/gluestack - ui - provider';\n/g, '');
appContent = appContent.replace(/<GluestackUIProvider mode="dark">/g, '<View style={{ flex: 1, backgroundColor: "black" }}>');
appContent = appContent.replace(/<\\/GluestackUIProvider > /g, '</View > ');
if (!appContent.includes('import { View }')) {
    appContent = 'import { View } from "react-native";\n' + appContent;
}
fs.writeFileSync(path.join(__dirname, 'App.tsx'), appContent);
console.log('Refactored App.tsx');
