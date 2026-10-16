import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Toast, spacing, type ToastKind } from '@qc/ui';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    start: spacing.lg,
    end: spacing.lg,
    bottom: spacing.lg,
  },
});

/** Short messages that fade by themselves ("Registered", "Reminder on"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    setItems((current) => [
      ...current.slice(-1),
      { id: Date.now() + Math.random(), message, kind },
    ]);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <View style={styles.host} pointerEvents="box-none">
        {items.map((item) => (
          <Toast
            key={item.id}
            message={item.message}
            kind={item.kind}
            onDismiss={() => setItems((current) => current.filter((i) => i.id !== item.id))}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
