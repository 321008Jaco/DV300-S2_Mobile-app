import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Image, Animated, StyleSheet, Dimensions } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import LoginScreen from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import HomeScreen from "./screens/HomeScreen";
import { Ionicons } from "@expo/vector-icons";
import ProfileScreen from "./screens/ProfileScreen";
import ViewFriends from "./screens/ViewFriend";
import Navbar from "./components/Navbar";

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function LaunchOverlay({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(onDone);
  }, [onDone, opacity, scale]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={require("./assets/PinPointSplash.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#eee",
          height: 65,
          borderRadius: 30,
          marginHorizontal: 20,
          marginBottom: 10,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
        tabBarIcon: ({ color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";
          if (route.name === "Map") iconName = "map";
          if (route.name === "Profile") iconName = "person";
          if (route.name === "Settings") iconName = "settings";
          return <Ionicons name={iconName} size={28} color={color} />;
        },
        tabBarActiveTintColor: "#FD5308",
        tabBarInactiveTintColor: "#666",
      })}
    >
      <Tab.Screen name="Map" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={DummyScreen} />
    </Tab.Navigator>
  );
}

function DummyScreen() {
  return null;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    (async () => {
      setReady(true);
    })();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="Home" component={Navbar} />
          <Stack.Screen name="ViewFriends" component={ViewFriends} options={{ title: "Profile" }} />
        </Stack.Navigator>
      </NavigationContainer>
      {showOverlay && <LaunchOverlay onDone={() => setShowOverlay(false)} />}
    </View>
  );
}

const { width } = Dimensions.get("window");
const styles = StyleSheet.create({
  backdrop: { backgroundColor: "#FD5308", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  logo: { width: width * 0.45, height: width * 0.45 },
});
