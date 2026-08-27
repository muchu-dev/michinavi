import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 直後の再マウントで即再取得されるのを防ぐ
        staleTime: 30 * 1000,
      },
    },
  });
}
