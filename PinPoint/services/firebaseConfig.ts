// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getReactNativePersistence from "@react-native-firebase/auth";
import { Platform } from "react-native";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC7xQfqzJJd_o_yS8eZ_3WPAtaZD0XHSVw",
  authDomain: "pinpoint-9a735.firebaseapp.com",
  projectId: "pinpoint-9a735",
  storageBucket: "pinpoint-9a735.firebasestorage.app",
  messagingSenderId: "106647663505",
  appId: "1:106647663505:web:42806c442fada8a3ae6030",
  measurementId: "G-XRXZZDE9W2"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

export const db = getFirestore(app);
export default app
