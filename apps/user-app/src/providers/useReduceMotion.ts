import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Follows the device's "reduce motion" setting, so sheets and toasts do not slide for people
 * who asked for less movement. Starts as false until the system answers.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    try {
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((value) => {
          if (active) setReduce(value);
        })
        .catch(() => undefined);
    } catch {
      // No answer from the system: keep the default.
    }
    // The web implementation returns nothing to unsubscribe, so the result may be missing.
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce) as
      { remove: () => void } | undefined;
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  return reduce;
}
