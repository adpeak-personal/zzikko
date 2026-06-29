import { useMutation } from "@tanstack/react-query";
import { generateBlogTitles } from "./api";

export function useGenerateBlogTitles() {
  return useMutation({
    mutationFn: generateBlogTitles,
  });
}
