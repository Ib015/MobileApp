import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
  StatusBar,
  AppState,
  AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const INITIAL_MINUTES = 25;
const DISTRACTION_KEY = "distractionCount";
const SESSIONS_KEY = "focusSessions";


type FocusSession = {
  id: string;
  date: string; // ISO string
  durationMinutes: number;
  category: string;
};

export default function TimerScreen() {
  const [baseMinutes, setBaseMinutes] = useState(INITIAL_MINUTES);
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const [categories, setCategories] = useState<string[]>([
    "Ders Çalışma",
    "Kodlama",
    "Proje",
    "Kitap Okuma",
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    "Ders Çalışma"
  );

  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [distractionCount, setDistractionCount] = useState(0);

  // AppState için ref'ler
  const appState = useRef(AppState.currentState);
  const isRunningRef = useRef(isRunning);
  const plannedSecondsRef = useRef<number | null>(null); // seans planlanan süre

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Dikkat dağınıklığını yükle
  useEffect(() => {
    const loadDistractions = async () => {
      try {
        const stored = await AsyncStorage.getItem(DISTRACTION_KEY);
        if (stored !== null) setDistractionCount(Number(stored));
      } catch (e) {
        console.warn("Distraction load error", e);
      }
    };
    loadDistractions();
  }, []);

  const incrementDistraction = async () => {
    setDistractionCount((prev) => {
      const next = prev + 1;
      AsyncStorage.setItem(DISTRACTION_KEY, String(next)).catch((e) =>
        console.warn("Distraction save error", e)
      );
      return next;
    });
  };

  // Seansı kaydet (dakika olarak)
  const saveSession = async (durationSeconds: number) => {
    try {
      const durationMinutes = durationSeconds / 60;
      if (durationMinutes <= 0) return;

      const newSession: FocusSession = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        durationMinutes,
        category: selectedCategory,
      };

      const existing = await AsyncStorage.getItem(SESSIONS_KEY);
      const sessions: FocusSession[] = existing ? JSON.parse(existing) : [];
      sessions.push(newSession);
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn("Save session error", e);
    }
  };

  // AppState listener (arka plana düşünce)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasActive = appState.current === "active";
      const goingBackground =
        nextAppState === "background" || nextAppState === "inactive";

      if (wasActive && goingBackground && isRunningRef.current) {
        setIsRunning(false);
        incrementDistraction();
        // hasStarted true kalıyor → buton "Devam Et"
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, []);

  // Sayaç
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          setHasStarted(false);

          const planned = plannedSecondsRef.current ?? baseMinutes * 60;
          void saveSession(planned); // tam seans kaydı
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, baseMinutes]);

  const formattedTime = () => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const handleIncreaseMinutes = () => {
    if (isRunning) return;
    const next = baseMinutes + 1;
    setBaseMinutes(next);
    setSecondsLeft(next * 60);
  };

  const handleDecreaseMinutes = () => {
    if (isRunning) return;
    const next = Math.max(1, baseMinutes - 1);
    setBaseMinutes(next);
    setSecondsLeft(next * 60);
  };

  const handleStart = () => {
    if (secondsLeft > 0) {
      plannedSecondsRef.current = baseMinutes * 60;
      setIsRunning(true);
      setHasStarted(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    // O ana kadar geçen süreyi seans olarak kaydet
    const planned = plannedSecondsRef.current ?? baseMinutes * 60;
    const elapsed = planned - secondsLeft;
    if (elapsed > 0) {
      void saveSession(elapsed);
    }

    setIsRunning(false);
    setBaseMinutes(INITIAL_MINUTES);
    setSecondsLeft(INITIAL_MINUTES * 60);
    setHasStarted(false);
    plannedSecondsRef.current = null;
  };

  // Kategori
  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
    }
    setNewCategory("");
  };

  const startButtonLabel = hasStarted ? "Devam Et" : "Başlat";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View className="content" style={styles.content}>
          <Text style={styles.title}>Timer</Text>

          {/* Kategori */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kategori</Text>

            <TouchableOpacity
              style={styles.categorySelector}
              onPress={() => setIsCategoryModalVisible(true)}
            >
              <Text style={styles.categorySelectorText}>
                {selectedCategory}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#555" />
            </TouchableOpacity>

            {selectedCategory && (
              <View style={styles.selectedChip}>
                <Text style={styles.selectedChipText}>{selectedCategory}</Text>
              </View>
            )}
          </View>

          {/* Sayaç */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Süre</Text>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>{formattedTime()}</Text>
            </View>

            <View style={styles.adjustRow}>
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={handleDecreaseMinutes}
                disabled={isRunning}
              >
                <Ionicons
                  name="remove-outline"
                  size={22}
                  color={isRunning ? "#b0bec5" : "#1d3557"}
                />
              </TouchableOpacity>

              <Text style={styles.minutesText}>{baseMinutes} dk</Text>

              <TouchableOpacity
                style={styles.adjustButton}
                onPress={handleIncreaseMinutes}
                disabled={isRunning}
              >
                <Ionicons
                  name="add-outline"
                  size={22}
                  color={isRunning ? "#b0bec5" : "#1d3557"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Butonlar */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.controlButton, styles.startButton]}
              onPress={handleStart}
              disabled={isRunning || secondsLeft === 0}
            >
              <Text style={styles.controlButtonText}>{startButtonLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.pauseButton]}
              onPress={handlePause}
              disabled={!isRunning}
            >
              <Text style={styles.controlButtonText}>Duraklat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.resetButton]}
              onPress={handleReset}
            >
              <Text style={styles.controlButtonText}>Sıfırla</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Kategori Modal */}
        <Modal
          visible={isCategoryModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsCategoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Kategori Seç</Text>

              <ScrollView style={{ maxHeight: 250 }}>
                {categories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.modalItem,
                        active && styles.modalItemActive,
                      ]}
                      onPress={() => handleSelectCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.modalItemText,
                          active && styles.modalItemTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#1976d2"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.addCategoryRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Yeni kategori ekle"
                  value={newCategory}
                  onChangeText={setNewCategory}
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddCategory}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCloseButton]}
                  onPress={() => setIsCategoryModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Tamam</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e3f2fd",
  },
  container: {
    flex: 1,
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1d3557",
    marginBottom: 24,
    textAlign: "center",
  },
  section: {
    width: "100%",
    marginBottom: 24,
  },
  sectionLabel: {
    color: "#546e7a",
    fontSize: 14,
    marginBottom: 8,
  },
  categorySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categorySelectorText: {
    color: "#1d3557",
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  selectedChip: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#bbdefb",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  selectedChipText: {
    color: "#0d47a1",
    fontSize: 12,
    fontWeight: "600",
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  timerLabel: {
    color: "#546e7a",
    fontSize: 14,
    marginBottom: 8,
  },
  timerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  timerText: {
    fontSize: 52,
    fontWeight: "700",
    color: "#1d3557",
    letterSpacing: 2,
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  adjustButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  minutesText: {
    marginHorizontal: 16,
    color: "#1d3557",
    fontSize: 18,
    fontWeight: "500",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  startButton: {
    backgroundColor: "#43a047",
  },
  pauseButton: {
    backgroundColor: "#fb8c00",
  },
  resetButton: {
    backgroundColor: "#e53935",
  },
  controlButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1d3557",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalItemActive: {
    backgroundColor: "#e3f2fd",
  },
  modalItemText: {
    fontSize: 14,
    color: "#1d3557",
  },
  modalItemTextActive: {
    fontWeight: "600",
  },
  addCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  addButton: {
    marginLeft: 8,
    backgroundColor: "#1d3557",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonsRow: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalCloseButton: {
    backgroundColor: "#1d3557",
  },
  modalButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
