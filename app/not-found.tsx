import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ marginTop: 6 }}>Page not found</h1>
      <p style={{ opacity: 0.8 }}>The page you are looking for does not exist.</p>
      <Link href="/boxes" style={{ display: "inline-block", marginTop: 10 }}>
        Go to boxes
      </Link>
    </main>
  );
}
