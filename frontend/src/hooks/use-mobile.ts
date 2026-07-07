import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const getIsMobile = React.useCallback(() => window.innerWidth < MOBILE_BREAKPOINT, []);

  const [isMobile, setIsMobile] = React.useState(getIsMobile);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const handleChange = () => {
      setIsMobile(getIsMobile());
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [getIsMobile]);

  return isMobile;
}
