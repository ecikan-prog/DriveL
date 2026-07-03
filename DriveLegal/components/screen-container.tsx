import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: object;
}

export function ScreenContainer({ children, style }: ScreenContainerProps) {
  return (
    <SafeAreaView style={[styles.container, style]}>
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