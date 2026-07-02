export function getUser() {
    if (typeof window === "undefined") {
      return null;
    }
  
    const raw =
      localStorage.getItem("user");
  
    if (!raw) {
      return null;
    }
  
    return JSON.parse(raw);
  }