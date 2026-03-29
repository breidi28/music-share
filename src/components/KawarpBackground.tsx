import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { KAWARP_SCRIPT } from './KawarpScript';

// Clean the ES module exports to make Kawarp available globally inside the WebView
const INJECTABLE_SCRIPT = KAWARP_SCRIPT
    .replace('export class Kawarp', 'class Kawarp')
    .replace('export default Kawarp;', 'window.Kawarp = Kawarp;');

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
        canvas { width: 100%; height: 100%; display: block; }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    
    <script>
        ${INJECTABLE_SCRIPT}
        
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("webgl");
        
        let kawarp;
        
        function init() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            // Wait for class to be attached
            if (window.Kawarp) {
                kawarp = new window.Kawarp(canvas, {
                    warpIntensity: 0.8,
                    blurPasses: 8,
                    animationSpeed: 1.0,
                    tintColor: [0, 0, 0],
                    tintIntensity: 0.1
                });
            }
        }
        
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            if(kawarp) kawarp.resize();
        });

        init();

        window.addEventListener("message", (event) => {
            try {
                if (!kawarp) init();
                if (!kawarp) return;
                
                const data = JSON.parse(event.data);
                if (data.type === 'loadGradient') {
                    kawarp.loadGradient(data.colors, 135);
                    kawarp.start();
                } else if (data.type === 'loadImage') {
                    kawarp.loadImage(data.url).then(() => {
                        kawarp.start();
                    }).catch(e => console.error('Image load error:', e));
                } else if (data.type === 'setOptions') {
                    kawarp.setOptions(data.options);
                }
            } catch (e) {
                console.error('Message processing error:', e);
            }
        });
        
        // Notify React Native that we are ready
        setTimeout(() => {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        }, 100);
    </script>
</body>
</html>
`;

type Props = {
    accent?: string;
    avatarUrl?: string | null;
    options?: any;
    style?: any;
};

export default function KawarpBackground({ accent = '#3B82F6', avatarUrl, options, style }: Props) {
    const webviewRef = useRef<WebView>(null);
    const readyRef = useRef(false);

    useEffect(() => {
        if (!readyRef.current) return;
        sendUpdate();
    }, [accent, avatarUrl]);

    useEffect(() => {
        if (!readyRef.current || !options) return;
        if (!webviewRef.current) return;
        
        const script = `window.postMessage('${JSON.stringify({ type: 'setOptions', options })}', '*'); true;`;
        webviewRef.current.injectJavaScript(script);
    }, [options]);

    const sendUpdate = () => {
        if (!webviewRef.current) return;
        
        let msg;
        if (avatarUrl) {
            // Make relative urls absolute natively
            const url = avatarUrl.startsWith('http') || avatarUrl.startsWith('data:') 
                            ? avatarUrl 
                            : `https://music-share-b4r8.onrender.com${avatarUrl}`;
            msg = { type: 'loadImage', url };
        } else {
            msg = { type: 'loadGradient', colors: ['#111111', accent, '#000000'] };
        }
        
        // Passing data to WebView
        const script = `window.postMessage('${JSON.stringify(msg)}', '*'); true;`;
        webviewRef.current.injectJavaScript(script);
    };

    return (
        <View style={[StyleSheet.absoluteFill, style, { zIndex: 0, backgroundColor: '#000' }]} pointerEvents="none">
            <WebView
                ref={webviewRef}
                source={{ html: HTML_CONTENT }}
                style={StyleSheet.absoluteFill}
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                pointerEvents="none"
                originWhitelist={['*']}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'ready') {
                            readyRef.current = true;
                            sendUpdate();
                            if (options) {
                                webviewRef.current?.injectJavaScript(`window.postMessage('${JSON.stringify({ type: 'setOptions', options })}', '*'); true;`);
                            }
                        }
                    } catch {}
                }}
            />
        </View>
    );
}
