export function filterHref(data: FormData): string {
  const query = new URLSearchParams();
  for (const [key, value] of data) {
    if (key !== "page" && typeof value === "string" && value !== "") {
      query.append(key, value);
    }
  }
  return `/?${query}`;
}

export function shouldNavigate(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}
