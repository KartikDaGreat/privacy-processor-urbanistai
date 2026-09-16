import { Toaster } from "sonner";
import Index from "@/pages/Index";

export default function App() {
  return (
    <>
      <Index />
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ className: "font-sans" }}
      />
    </>
  );
}
