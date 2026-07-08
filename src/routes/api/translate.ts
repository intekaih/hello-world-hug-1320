import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/translate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            text?: string;
            target?: string;
            hint?: string;
          };
          // Mock: if a hint (pre-translated) is provided, return it.
          // Otherwise echo with a [VI] prefix so the UI can demonstrate toggling.
          if (body.hint) return Response.json({ text: body.hint });
          return Response.json({
            text: `[${body.target ?? "vi"}] ${body.text ?? ""}`,
          });
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
      },
    },
  },
});
