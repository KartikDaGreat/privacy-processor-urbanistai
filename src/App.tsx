import { Toaster } from "sonner";
import Index from "@/pages/Index";

export default function App() {
  return (
    <>
      <Index />
      <Toaster
        theme="dark"
        /* Bottom-right overlapped the comparison controls, which sit low on the page. */
        position="top-center"
        richColors
        closeButton
        toastOptions={{ className: "font-sans" }}
      />
    </>
  );
}
