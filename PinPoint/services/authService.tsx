import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

export const registerUser = async (email: string, password: string, username: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      username: username,
      createdAt: new Date().toISOString(),
      profilePicture: null, // optional, default null
    });

    return user;
  } catch (error: any) {
    console.error("Error registering user:", error.message);
    throw error;
  }
};
