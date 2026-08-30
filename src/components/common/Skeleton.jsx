export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`bg-border animate-pulse rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}
