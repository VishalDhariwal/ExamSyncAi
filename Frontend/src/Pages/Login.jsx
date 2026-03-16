import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth"

import { auth } from "../firebase/firebase"

export default function Login(){

  const navigate = useNavigate()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [isSignup,setIsSignup] = useState(false)

  const handleAuth = async () => {

    try{

      let userCredential

      if(isSignup){

        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        )

      }else{

        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        )

      }

      const user = userCredential.user

      localStorage.setItem("user", user.email)

      navigate("/dashboard")

    }catch(error){

      console.error(error)
      alert(error.message)

    }

  }

  return(

    <div className="h-screen flex items-center justify-center bg-gray-900">

      <div className="bg-gray-800 p-10 rounded-xl text-white w-96">

        <h1 className="text-2xl font-bold mb-6 text-center">
          {isSignup ? "Signup" : "Login"}
        </h1>

        <input
          className="w-full p-3 rounded mb-4 text-black"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full p-3 rounded mb-6 text-black"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          onClick={handleAuth}
          className="bg-blue-500 w-full p-3 rounded"
        >
          {isSignup ? "Signup" : "Login"}
        </button>

        <p
          className="text-sm text-center mt-4 cursor-pointer text-gray-300"
          onClick={()=>setIsSignup(!isSignup)}
        >
          {isSignup
            ? "Already have an account? Login"
            : "Don't have an account? Signup"}
        </p>

      </div>

    </div>
  )
}