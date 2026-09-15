import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvdPwldUmFgE47l0QSud5TMFoWj-QfIfA",
  authDomain: "digital-notebook-12726.firebaseapp.com",
  projectId: "digital-notebook-12726",
  storageBucket: "digital-notebook-12726.firebasestorage.app",
  messagingSenderId: "716544081139",
  appId: "1:716544081139:web:93ebbc594b2b4d1e928b86",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);