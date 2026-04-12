import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

export const generateExam = (data) =>
  API.post("/generate-exam", data)

export const submitExam = (data) =>
  API.post("/submit-exam", data)

export const getStructure = () =>
  API.get("/structure")