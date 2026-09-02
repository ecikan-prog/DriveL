import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets, Edge } from "react-native-safe-area-context";

interface ScreenContainerProps {
  children?: React.ReactNode;
  edges?: Edge[];
  style?: object;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["top", "bottom", "left", "right"],
  style,
  containerClassName,
  safeAreaClassName,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const paddingStyle = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };

  return (
    <View style={styles.container} className={containerClassName}>
      <View style={[{ flex: 1 }, paddingStyle, style]} className={safeAreaClassName}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
});
