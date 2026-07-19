// Pass-through wrapper kept for compatibility.
// Removed double-rAF fade that added ~32ms latency + flicker on every navigation.
const PageTransition = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export default PageTransition;
