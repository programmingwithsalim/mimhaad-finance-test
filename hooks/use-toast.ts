// Update the hooks/use-toast.ts file to also export the toast function
import { useToast as useToastOriginal, toast } from "@/components/ui/use-toast"

export const useToast = useToastOriginal
export { toast }
