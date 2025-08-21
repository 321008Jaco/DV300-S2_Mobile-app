// components/LaunchOverlay.tsx
import React, { useEffect, useRef } from "react";
import { Image, Animated, StyleSheet, Dimensions, Easing } from "react-native";

export default function LaunchOverlay({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.08, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
      Animated.timing(scale, { toValue: 1.0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.12, duration: 550, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, [onDone, opacity, scale]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={require("../assets/PinPointSplash.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
}

const { width } = Dimensions.get("window");
const styles = StyleSheet.create({
  backdrop: { backgroundColor: "#FD5308", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  logo: { width: width * 0.45, height: width * 0.45 },
});
