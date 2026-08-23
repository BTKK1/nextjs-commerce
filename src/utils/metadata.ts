import { IMAGES } from "@/utils/constants";

export const staticSeo = {
  default: {
    title: "Nbeh AI",
    description: "Nbeh AI in-store sales agent",
    image: IMAGES.logo,
    canonical: "/",
  },
  register : {
    title: "Register",
    description: "Register for Nbeh AI",
    image: IMAGES.logo,
    canonical: "/customer/register",
  },
  login: {
    title: "Login",
    description: "Sign in to Nbeh AI",
    image: IMAGES.logo,
    canonical: "/customer/login",
  },
  forget:{
    title: "Forget Password",
  description: "Recover your account by resetting your password.",
  image: IMAGES.logo,
  canonical: "/customer/forget-password",
  }
};
