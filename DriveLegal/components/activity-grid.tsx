import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  safeAreaStyle?: StyleProp<ViewStyle>;
  containerClassName?: string;
  safeAreaClassName?: string;
  edges?: Array<"top" | "bottom" | "left" | "right">;
}

export function ScreenContainer({
  children,
  style,
  containerStyle,
  safeAreaStyle,
  containerClassName,
  safeAreaClassName,
}: ScreenContainerProps) {
  const combinedClassName = [containerClassName, safeAreaClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <SafeAreaView
      className={combinedClassName}
      style={[
        styles.container,
        style,
        containerStyle,
        safeAreaStyle,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
