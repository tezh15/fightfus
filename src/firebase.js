import { getApp, getApps, initializeApp } from "@firebase/app";
import { getAuth } from "@firebase/auth";
import { getFirestore } from "@firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAr_M5VWtrfHXyJ0cE_mog6k7wOZWBeo-g",
  authDomain: "fightfus-league.firebaseapp.com",
  projectId: "fightfus-league",
  storageBucket: "fightfus-league.firebasestorage.app",
  messagingSenderId: "1085224697275",
  appId: "1:1085224697275:web:c1eb0a6c7b45a6d04a589e",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
