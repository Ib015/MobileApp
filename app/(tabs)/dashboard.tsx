import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart, PieChart } from "react-native-chart-kit";
import { useFocusEffect } from "expo-router";

const DISTRACTION_KEY = "distractionCount";
const SESSIONS_KEY = "focusSessions";

type FocusSession = {
  id: string;
  date: string; // ISO
  durationMinutes: number;
  category: string;
};

const screenWidth = Dimensions.get("window").width - 60;

const chartConfig = {
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(26, 35, 126, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 71, 79, ${opacity})`,
  barPercentage: 0.6,
};

const pieColors = ["#1e88e5", "#43a047", "#fb8c00", "#8e24aa", "#e53935"];

export default function DashboardScreen() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [distractionCount, setDistractionCount] = useState(0);

  const loadData = async () => {
  try {
    const s = await AsyncStorage.getItem(SESSIONS_KEY);
    const d = await AsyncStorage.getItem(DISTRACTION_KEY);

    if (s) setSessions(JSON.parse(s));
    else setSessions([]);

    if (d) setDistractionCount(Number(d));
    else setDistractionCount(0);
  } catch (error) {
    console.warn("Dashboard load error:", error);
  }
};

useFocusEffect(
  useCallback(() => {
    loadData();
  }, [])
);

  // ---- Genel istatistikler ----
  const todayStr = new Date().toISOString().slice(0, 10);

  const todayTotal = sessions
    .filter((s) => s.date.slice(0, 10) === todayStr)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const allTimeTotal = sessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0
  );

  // ---- Son 7 gün bar chart verisi ----
  const last7Days = (() => {
    const arr: { label: string; total: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);

      const total = sessions
        .filter((s) => s.date.slice(0, 10) === key)
        .reduce((sum, s) => sum + s.durationMinutes, 0);

      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      arr.push({ label, total });
    }
    return arr;
  })();

  const barData = {
    labels: last7Days.map((d) => d.label),
    datasets: [
      {
        data: last7Days.map((d) => d.total),
      },
    ],
  };

  // ---- Kategorilere göre dağılım (pie chart) ----
  const categoryTotals: Record<string, number> = {};
  sessions.forEach((s) => {
    categoryTotals[s.category] =
      (categoryTotals[s.category] || 0) + s.durationMinutes;
  });

  const pieData = Object.keys(categoryTotals).map((cat, idx) => ({
    name: cat,
    population: categoryTotals[cat],
    color: pieColors[idx % pieColors.length],
    legendFontColor: "#37474f",
    legendFontSize: 12,
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>Dashboard</Text>

      {/* Genel İstatistikler */}
      <View style={styles.cardsRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Bugün Toplam Odaklanma</Text>
          <Text style={styles.cardValue}>{todayTotal.toFixed(1)} dk</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Tüm Zamanlar</Text>
          <Text style={styles.cardValue}>{allTimeTotal.toFixed(1)} dk</Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 12 }]}>
        <Text style={styles.cardLabel}>Toplam Dikkat Dağınıklığı</Text>
        <Text style={styles.cardValue}>{distractionCount}</Text>
      </View>

      {/* Son 7 gün bar chart */}
      <View style={[styles.card, { marginTop: 20 }]}>
        <Text style={styles.cardLabel}>Son 7 Gün Odaklanma Süresi (dk)</Text>
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore */}
        <BarChart
          data={barData as any}
          width={screenWidth}
          height={220}
          chartConfig={chartConfig as any}
          fromZero
          style={{ marginTop: 12, borderRadius: 16, alignSelf:"center" }}
        />
      </View>

      {/* Kategori dağılımı pie chart */}
      <View style={[styles.card, { marginTop: 20 }]}>
        <Text style={styles.cardLabel}>Kategorilere Göre Dağılım</Text>
        {pieData.length > 0 ? (
          <PieChart
            data={pieData as any}
            width={screenWidth}
            height={220}
            chartConfig={chartConfig as any}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="0"
            style={{ marginTop: 12 }}
          />

        ) : (
          <Text style={styles.emptyText}>
            Henüz kayıtlı seans yok. Zamanlayıcıyı kullanarak veri oluştur.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1d3557",
    marginBottom: 16,
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  card: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 16,
    elevation: 2,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    marginRight: 8,
  },
  cardLabel: {
    fontSize: 13,
    color: "#546e7a",
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1d3557",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 13,
    color: "#90a4ae",
  },
});
