export function renderFieldError(message: string | undefined, id: string) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-12 text-void">
      {message}
    </p>
  )
}
