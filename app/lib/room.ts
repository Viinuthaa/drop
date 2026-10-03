export function generateRoomCode(length = 6) {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

  return Array.from(
    { length },
    () => characters[Math.floor(Math.random() * characters.length)]
  ).join("")
}