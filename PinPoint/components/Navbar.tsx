import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function Navbar() {
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
          let iconName: keyof typeof Ionicons.glyphMap = "map";
          if (route.name === "Map") iconName = "map";
          if (route.name === "Profile") iconName = "person";
          return <Ionicons name={iconName} size={28} color={color} />;
        },
        tabBarActiveTintColor: "#FD5308",
        tabBarInactiveTintColor: "#666",
      })}
    >
      <Tab.Screen name="Map" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
