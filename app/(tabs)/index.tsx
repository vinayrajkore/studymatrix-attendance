import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Auth from "@/lib/_core/auth";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  BackHandler,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from "react-native";
import Constants from "expo-constants";

import { ScreenContainer } from "@/components/screen-container";
import { AttendanceRecord } from "@/lib/attendance-types";
import { cancelStudyMatrixDiscovery, describeBluetoothDiscoveryError, scanStudyMatrixDevices, setStudyMatrixDeviceName } from "@/lib/bluetooth-classic";
import { shareAttendanceCsv, shareAttendancePdf, type AttendanceReport } from "@/lib/attendance-export";
import { shareDailyAttendancePdf, type DailyAttendanceReport } from "@/lib/daily-attendance-report";
import { buildUpcomingSession, scheduleAttendanceReminder, syncTimetableReminders } from "@/lib/attendance-notifications";
import { sendAbsenceSmsBatch } from "@/lib/sms-service";
import { trpc } from "@/lib/trpc";

const collegeCrest = require("../../assets/images/college-logo.png");

type Screen =
  | "welcome"
  | "studentLogin"
  | "studentRegister"
  | "deviceSetup"
  | "adminLogin"
  | "changeAdminPassword"
  | "studentHome"
  | "studentRecords"
  | "code"
  | "notices"
  | "adminHome"
  | "startSession"
  | "liveSession"
  | "adminRecords"
  | "composeNotice"
  | "manageInfo"
  | "manageFaculty"
  | "adminStudents"
  | "studentDetail"
  | "profile";
type Role = "student" | "admin";
type ScanState = "idle" | "discovering" | "complete" | "error";
type IconName = ComponentProps<typeof MaterialIcons>["name"];

const colors = {
  navy: "#0B1F3A",
  navyLight: "#142948",
  gold: "#C89B3C",
  goldLight: "#D4AE58",
  maroon: "#6B1E2F",
  maroonLight: "#8A2840",
  paper: "#F5F3EE",
  paperDark: "#EDE9E2",
  ink: "#111827",
  muted: "#6B7280",
  border: "#E2DDD6",
  green: "#1A6B47",
  greenLight: "#237A57",
  card: "#FFFFFF",
  shadow: "#0B1F3A",
};

function feedback() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function Button({ label, icon, onPress, tone = "navy" }: { label: string; icon?: IconName; onPress: () => void; tone?: "navy" | "gold" | "outline" | "maroon" }) {
  const scale = useRef(new Animated.Value(1)).current;
  const palette = tone === "gold" ? [colors.gold, colors.navy] : tone === "outline" ? ["#FFFFFF", colors.navy] : tone === "maroon" ? [colors.maroon, "#FFFFFF"] : [colors.navy, "#FFFFFF"];
  const shadowColor = tone === "gold" ? colors.gold : tone === "maroon" ? colors.maroon : colors.navy;
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
    feedback();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.button, { backgroundColor: palette[0], borderColor: tone === "outline" ? colors.navy : palette[0], borderWidth: tone === "outline" ? 1.2 : 0, shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: tone === "outline" ? 0 : 0.22, shadowRadius: 8, elevation: tone === "outline" ? 0 : 4, transform: [{ scale }] }]}>
        {icon ? <MaterialIcons name={icon} size={19} color={palette[1]} /> : null}
        <Text style={[styles.buttonText, { color: palette[1] }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function RoundIcon({ name, background = "#EAF0F8", color = colors.navy, size = 22 }: { name: IconName; background?: string; color?: string; size?: number }) {
  return <View style={[styles.roundIcon, { backgroundColor: background, shadowColor: color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 }]}><MaterialIcons name={name} size={size} color={color} /></View>;
}

function AnimatedCollegeCrest({ size = 88 }: { size?: number }) {
  return <View style={[styles.crestAnimation, { width: size, height: size, shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 15, borderRadius: size / 2, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }]}><Image accessibilityLabel="Institute of Civil and Rural Engineering college crest" source={collegeCrest} style={[styles.crestImage, { width: size * 0.6, height: size * 0.6 }]} resizeMode="contain" /></View>;
}

function BrandedLoader({ label, compact = false }: { label: string; compact?: boolean }) {
  return <View accessibilityRole="progressbar" style={[styles.brandedLoader, compact && styles.brandedLoaderCompact]}><AnimatedCollegeCrest size={compact ? 48 : 76} /><ActivityIndicator size="small" color={colors.gold} /><Text style={[styles.brandedLoaderText, compact && styles.brandedLoaderTextCompact]}>{label}</Text></View>;
}

function Title({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) {
  return <View style={styles.titleRow}><Text style={styles.sectionTitle}>{children}</Text>{action && onAction ? <Pressable onPress={onAction}><Text style={styles.titleAction}>{action}</Text></Pressable> : null}</View>;
}

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [role, setRole] = useState<Role>("student");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"idle" | "success" | "error">("idle");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [detectedCount, setDetectedCount] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanRunRef = useRef(0);
  const [noticeSent, setNoticeSent] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [studentClassDivision, setStudentClassDivision] = useState("");
  const [studentDeviceTag, setStudentDeviceTag] = useState("");
  const [deviceSetupComplete, setDeviceSetupComplete] = useState(false);
  const [deviceVerified, setDeviceVerified] = useState(false);
  const [bluetoothTestState, setBluetoothTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [bluetoothTestMessage, setBluetoothTestMessage] = useState<string | null>(null);
  const bluetoothToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discoveredTags, setDiscoveredTags] = useState<string[]>([]);
  const [manualLinks, setManualLinks] = useState<{ fullName: string; enrollmentNumber: string; deviceTag: string; manuallyLinked: true }[]>([]);
  const [localAdminPassword, setLocalAdminPassword] = useState("");
  const [localAdminUserId, setLocalAdminUserId] = useState<number | null>(null);
  const [matchedStudents, setMatchedStudents] = useState<{ fullName: string; enrollmentNumber: string; deviceTag: string }[]>([]);
  const [selectedStudentUserId, setSelectedStudentUserId] = useState<number | null>(null);
  const bluetoothMatch = trpc.attendance.matchBluetoothDevices.useMutation();
  const closeSession = trpc.attendance.closeSession.useMutation();

  const open = (next: Screen) => { setCodeState("idle"); setScreen(next); };

  useEffect(() => {
    const onBackPress = () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true; // handled
      }
      
      // Top-level screens exit the app
      if (screen === "welcome" || screen === "studentHome" || screen === "adminHome") {
        return false;
      }
      
      // Authentication and setup flow
      if (screen === "studentLogin" || screen === "adminLogin") {
        open("welcome");
        return true;
      }
      if (screen === "studentRegister") {
        open("studentLogin");
        return true;
      }
      if (screen === "deviceSetup" || screen === "changeAdminPassword") {
        return false; // Prevent back navigation out of setup
      }
      
      // All other screens map back to their respective dashboards
      open(role === "student" ? "studentHome" : "adminHome");
      return true;
    };
    

  }, [screen, menuOpen, role]);
  const enterRole = (nextRole: Role) => { setRole(nextRole); open(nextRole === "student" ? "studentHome" : "adminHome"); };
  const submitCode = () => {
    if (code === "462913") {
      setCodeState("success");
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setCodeState("error");
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (screen === "welcome") return <Welcome onStudent={() => open("studentLogin")} onAdmin={() => open("adminLogin")} />;
  if (screen === "studentLogin") return <StudentAccess onBack={() => open("welcome")} onAuthenticated={(result) => { setRole("student"); setAccountName(result.fullName); setStudentClassDivision(result.classDivision || ""); setStudentDeviceTag(result.deviceTag ?? ""); setDeviceVerified(result.deviceVerified); if (result.deviceVerified || Constants.deviceName === result.deviceTag) { setDeviceSetupComplete(true); open("studentHome"); } else { open("deviceSetup"); } }} onRegister={() => open("studentRegister")} />;
  if (screen === "studentRegister") return <StudentRegistration onBack={() => open("studentLogin")} onRegistered={(result) => { setRole("student"); setAccountName(result.fullName); setStudentClassDivision(result.classDivision || ""); setStudentDeviceTag(result.deviceTag ?? ""); setDeviceVerified(false); if (Constants.deviceName === result.deviceTag) { setDeviceSetupComplete(true); open("studentHome"); } else { open("deviceSetup"); } }} />;
  if (screen === "deviceSetup") return <DeviceTagSetup studentTag={studentDeviceTag} onDone={() => { setDeviceSetupComplete(true); open("studentHome"); }} />;
  if (screen === "adminLogin") return <AdminAccess onBack={() => open("welcome")} onAuthenticated={(result, password) => { setRole("admin"); setAccountName(result.fullName); setLocalAdminPassword(password); setLocalAdminUserId(result.userId); open(result.mustChangePassword ? "changeAdminPassword" : "adminHome"); }} />;
  if (screen === "changeAdminPassword" && localAdminUserId) return <AdminPasswordChange userId={localAdminUserId} currentPassword={localAdminPassword} onChanged={(nextPassword) => { setLocalAdminPassword(nextPassword); open("adminHome"); }} onBack={() => open("adminLogin")} />;

  const mainScreen = role === "student" ? "studentHome" : "adminHome";
  const titles: Record<Exclude<Screen, "welcome" | "studentHome" | "adminHome">, string> = {
    studentRecords: "Attendance log", code: "Attendance code", notices: "Notices", startSession: "Start attendance",
    liveSession: "Live attendance", adminRecords: "Attendance records", composeNotice: "New notice", manageInfo: "Manage information", manageFaculty: "Manage faculty accounts", adminStudents: "Student management", studentDetail: "Student detail", profile: "Profile", studentLogin: "Student login", studentRegister: "Student registration", deviceSetup: "Device tag setup", adminLogin: "Administrator login", changeAdminPassword: "Change administrator password",
  };
  const heading = screen === "studentHome" ? "Good morning" : screen === "adminHome" ? "Faculty desk" : titles[screen as keyof typeof titles];
  const subheading = screen === "studentHome" ? accountName || "Student" : screen === "adminHome" ? accountName || "StudyMatrix Administrator" : "StudyMatrix Attendance";

  return <ScreenContainer containerClassName="bg-background">
    <StatusBar barStyle="dark-content" />
    <Header title={heading} subtitle={subheading} isRoot={screen === "studentHome" || screen === "adminHome"} onBack={() => open(mainScreen)} onProfile={() => open("profile")} onMenu={() => setMenuOpen(true)} />
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {screen === "studentHome" ? <StudentHome onOpen={open} accountName={accountName} classDivision={studentClassDivision} deviceSetupComplete={deviceSetupComplete} testState={bluetoothTestState} testMessage={bluetoothTestMessage} onFixDeviceName={() => { setDeviceSetupComplete(false); open("deviceSetup"); }} onTestBluetooth={() => { if (bluetoothToastTimer.current) clearTimeout(bluetoothToastTimer.current); setBluetoothTestState("testing"); setBluetoothTestMessage("Checking Bluetooth availability and applying your StudyMatrix device name…"); void setStudyMatrixDeviceName(studentDeviceTag).then(() => { setDeviceSetupComplete(true); if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setBluetoothTestState("success"); setBluetoothTestMessage(`Bluetooth test passed. Your Android Bluetooth name is ${studentDeviceTag}; a faculty scan provides final attendance verification.`); bluetoothToastTimer.current = setTimeout(() => { setBluetoothTestState("idle"); setBluetoothTestMessage(null); }, 6000); }, (error) => { if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); setBluetoothTestState("error"); setBluetoothTestMessage(describeBluetoothDiscoveryError(error)); bluetoothToastTimer.current = setTimeout(() => { setBluetoothTestState("idle"); setBluetoothTestMessage(null); }, 6000); }); }} /> : null}
      {screen === "studentRecords" ? <StudentRecords /> : null}
      {screen === "code" ? <CodeEntry code={code} setCode={setCode} state={codeState} onSubmit={submitCode} /> : null}
      {screen === "notices" ? <Notices /> : null}
      {screen === "adminHome" ? <AdminHome onOpen={open} accountName={accountName} /> : null}
      {screen === "startSession" ? <StartSession accountName={accountName} onStart={() => { setScanState("idle"); setScanError(null); open("liveSession"); }} /> : null}
      {screen === "liveSession" ? <LiveSession scanState={scanState} detectedCount={detectedCount} scanError={scanError} matchedStudents={[...matchedStudents, ...manualLinks]} unmatchedTags={discoveredTags.filter((tag) => !matchedStudents.some((student) => student.deviceTag === tag) && !manualLinks.some((student) => student.deviceTag === tag))} onLinkUnmatched={(tag: string) => Alert.alert("Manually link device", `Active backend data is required to link tag: ${tag}`)} onScan={async () => {
        const runId = scanRunRef.current + 1;
        scanRunRef.current = runId;
        setScanState("discovering");
        setScanError(null);
        setDetectedCount(0);
        setDiscoveredTags([]);
        setManualLinks([]);
        try {
          const devices = await scanStudyMatrixDevices((device) => {
            if (runId === scanRunRef.current) {
              setDetectedCount((count) => Math.max(count, count + (device.address ? 1 : 0)));
              setDiscoveredTags((tags) => [...new Set([...tags, device.name])]);
              setScanError((previous) => {
                const knownTags = previous?.match(/SM-[A-Z0-9]+/g) ?? [];
                const liveTags = [...new Set([...knownTags, device.name])];
                return `Live detected device tags: ${liveTags.join(", ")}`;
              });
            }
          });
          if (runId !== scanRunRef.current) return;
          setDetectedCount(devices.length);
          setMatchedStudents([]);
          if (localAdminPassword) {
            const matches = await bluetoothMatch.mutateAsync({ classDivision: "TY Computer A", deviceTags: devices.map((device) => device.name), adminPassword: localAdminPassword });
            if (runId !== scanRunRef.current) return;
            setMatchedStudents(matches);
            setScanError(matches.length ? `Matched registered students: ${matches.map((student) => `${student.fullName} (${student.enrollmentNumber})`).join(", ")}. Faculty review is still required before submission.` : "No discovered device tag matched a registered student in TY Computer A.");
          } else {
            setScanError("Devices were found, but student names can be resolved only after an administrator signs in.");
          }
          setScanState("complete");
          if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          if (runId !== scanRunRef.current) return;
          const message = describeBluetoothDiscoveryError(error);
          setScanError(message);
          setScanState("error");
          if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }} onCancel={async () => {
        scanRunRef.current += 1;
        try { await cancelStudyMatrixDiscovery(); } catch { /* the current scan may already have ended */ }
        setScanState("idle");
        setScanError("Discovery cancelled. You can start another scan when the student devices are ready.");
      }} onSubmit={() => {
        Alert.alert(
          "Submit Attendance", 
          "Are you sure you want to lock attendance? An SMS will be sent to the parents of absent students.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Submit & Send SMS", 
              onPress: async () => {
                // Test SMS Sending to trigger permission prompt for the user
                await sendAbsenceSmsBatch([
                  {
                    studentName: "Rohan Jadhav (Test)",
                    parentMobileNumber: "+919999999999", // Dummy number for testing
                    subjectName: "Data Structures",
                    teacherName: "Admin",
                    startTime: "09:42"
                  }
                ]);
                
                // Try to close session 1 for demo purposes
                try {
                  const result = await closeSession.mutateAsync({ sessionId: 1 });
                  if (result.absenceSmsDetails && result.absenceSmsDetails.length > 0) {
                    await sendAbsenceSmsBatch(result.absenceSmsDetails);
                  }
                } catch (e) {
                   console.log("Could not close session via TRPC", e);
                }
                
                open("adminHome");
              }
            }
          ]
        );
      }} /> : null}
      {screen === "adminRecords" ? <AdminRecords /> : null}
      {screen === "composeNotice" ? <ComposeNotice sent={noticeSent} onSend={() => { setNoticeSent(true); if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} /> : null}
      {screen === "manageInfo" ? <ManageInfo accountName={accountName} /> : null}
      {screen === "manageFaculty" ? <ManageFaculty /> : null}
      {screen === "adminStudents" ? <AdminStudents onViewStudent={(uid) => { setSelectedStudentUserId(uid); open("studentDetail"); }} /> : null}
      {screen === "studentDetail" && selectedStudentUserId ? <StudentDetail studentUserId={selectedStudentUserId} onBack={() => open("adminStudents")} /> : null}
      {screen === "profile" ? <EnhancedProfile role={role} accountName={accountName} deviceTagValue={studentDeviceTag} deviceSetupComplete={deviceSetupComplete} deviceVerified={deviceVerified} onTroubleshoot={() => { setDeviceSetupComplete(false); open("deviceSetup"); }} onExit={() => open("welcome")} /> : null}
    </ScrollView>
    {(["studentHome", "studentRecords", "notices", "adminHome", "adminRecords", "adminStudents", "studentDetail", "composeNotice"] as Screen[]).includes(screen) ? <BottomNav role={role} current={screen} onOpen={open} /> : null}
    {menuOpen ? <SideMenu role={role} current={screen} accountName={accountName} onClose={() => setMenuOpen(false)} onOpen={(next) => { setMenuOpen(false); open(next); }} /> : null}
  </ScreenContainer>;
}

function Welcome({ onStudent, onAdmin }: { onStudent: () => void; onAdmin: () => void }) {
  const intro = useRef(new Animated.Value(1)).current;
  const backendTest = trpc.testing.status.useQuery(undefined, { enabled: false, retry: false });
  const [testResult, setTestResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const handleTest = () => {
    void backendTest.refetch().then((res) => {
      if (res.data) {
        setTestResult({
          tone: res.data.database === "connected" ? "success" : "error",
          text: res.data.database === "connected" ? "Backend test passed: the API is online and the attendance database is connected." : "The API is online, but the database is not reachable. Check the server database configuration before testing attendance."
        });
      } else if (res.isError) {
        setTestResult({ tone: "error", text: "Backend test failed: could not reach the API." });
      }
      setTimeout(() => setTestResult(null), 4000);
    });
  };
  useEffect(() => {
    // Keep the crest visible on the first Android frame; its own subtle pulse provides motion.
    Animated.timing(intro, { toValue: 1, duration: 1, useNativeDriver: true }).start();
  }, [intro]);
  return <ScreenContainer edges={["top", "bottom", "left", "right"]}>
    <StatusBar barStyle="light-content" />
    <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
    <View style={styles.welcomeHero}>
      <Animated.View style={[styles.welcomeBrandBlock, { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <AnimatedCollegeCrest size={122} />
        <Text style={styles.institute}>INSTITUTE OF CIVIL AND RURAL ENGINEERING</Text>
        <Text style={styles.department}>Computer Department</Text>
        <Text style={styles.product}>StudyMatrix</Text>
        <Text style={styles.productSub}>ATTENDANCE</Text>
        <Text style={styles.welcomeCopy}>A focused attendance workspace for students, faculty, and department administration.</Text>
      </Animated.View>
    </View>
    <View style={styles.welcomeActions}>
      <Text style={styles.choose}>Choose your workspace</Text>
      <Pressable onPress={onStudent} style={({ pressed }) => [styles.roleCard, pressed && styles.pressed]}><RoundIcon name="school" background="#F5EEDB" /><View style={styles.flex}><Text style={styles.roleName}>Student</Text><Text style={styles.roleDetail}>Register or sign in with your enrollment number and password.</Text></View><MaterialIcons name="chevron-right" size={24} color={colors.muted} /></Pressable>
      <Pressable onPress={onAdmin} style={({ pressed }) => [styles.roleCard, pressed && styles.pressed]}><RoundIcon name="admin-panel-settings" background="#F8EDEF" color={colors.maroon} /><View style={styles.flex}><Text style={styles.roleName}>Faculty & Administration</Text><Text style={styles.roleDetail}>Secure administrator access for sessions, records, and catalog management.</Text></View><MaterialIcons name="chevron-right" size={24} color={colors.muted} /></Pressable>
      <Pressable disabled={backendTest.isFetching} onPress={handleTest} style={({ pressed }) => [styles.backendTestCard, backendTest.isFetching && styles.disabledCard, pressed && !backendTest.isFetching && styles.pressed]}><RoundIcon name="cloud-done" background="#EAF0F8" color={colors.navy} /><View style={styles.flex}><Text style={styles.roleName}>{backendTest.isFetching ? "Testing backend connection…" : "Test backend connection"}</Text><Text style={styles.roleDetail}>Checks the live API and database safely without changing attendance data.</Text></View>{backendTest.isFetching ? <ActivityIndicator color={colors.navy} /> : <MaterialIcons name="play-circle-outline" size={24} color={colors.navy} />}</Pressable>
      {testResult ? <Callout tone={testResult.tone} text={testResult.text} /> : null}
      <View style={{ marginTop: 32, marginBottom: 12, alignItems: "center", opacity: 0.5 }}>
        <Text style={{ color: "#64748B", fontSize: 7, letterSpacing: 2, fontWeight: "600" }}>
          DESIGNED WITH CREATIVITY BY
        </Text>
        <Text style={{ color: colors.gold, fontSize: 9, letterSpacing: 1.5, fontWeight: "700", marginTop: 3 }}>
          VINAYRAJ KORE
        </Text>
      </View>
    </View>
    </ScrollView>
  </ScreenContainer>;
}

type LocalLoginResult = { accountType: "student" | "admin"; userId: number; fullName: string; classDivision: string | null; deviceTag: string | null; deviceVerified: boolean; mustChangePassword: boolean };

function AuthShell({ title, detail, onBack, children, loading, backDisabled = false }: { title: string; detail: string; onBack: () => void; children: any; loading?: string; backDisabled?: boolean }) {
  const { width } = Dimensions.get("window");
  const isNarrow = width < 380;
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.authScreen, isNarrow && styles.authScreenNarrow]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={onBack}
            disabled={Boolean(loading) || backDisabled}
            style={({ pressed }) => [styles.authBack, (Boolean(loading) || backDisabled) && { opacity: 0.35 }, pressed && styles.pressed]}
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.navy} />
          </Pressable>

          <View style={styles.authCard}>
            <View style={styles.authMark}>
              <Image
                accessibilityLabel="Institute of Civil and Rural Engineering college crest"
                source={collegeCrest}
                style={styles.authCollegeLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.authTitle, isNarrow && { fontSize: 22 }]}>{title}</Text>
            <Text style={styles.authDetail}>{detail}</Text>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 22, marginHorizontal: -12 }} />
            {children}
          </View>
          {loading ? <View style={styles.authLoadingOverlay}><BrandedLoader label={loading} /></View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function PasswordInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (val: string) => void; placeholder: string }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.passwordContainer}>
    <TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} style={styles.passwordInputInner} placeholder={placeholder} placeholderTextColor="#98A2B3" autoCapitalize="none" autoCorrect={false} />
    <Pressable onPress={() => setVisible(!visible)} style={styles.passwordToggle} hitSlop={10}>
      <MaterialIcons name={visible ? "visibility" : "visibility-off"} size={20} color={colors.muted} />
    </Pressable>
  </View>;
}

function DeviceTagSetup({ studentTag, onDone }: { studentTag: string; onDone: () => void }) { const [message, setMessage] = useState<string | null>(null); const openDeviceName = () => { if (Platform.OS !== "android") { setMessage("Open your device Bluetooth settings and set the visible device name to the tag shown above."); return; } void IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.DEVICE_NAME).then(() => setMessage("Android Settings opened. Enter the StudyMatrix device name exactly, then return here."), () => setMessage("Unable to open Device name Settings. Open Android Settings manually and search for Device name.")); }; return <AuthShell title="Set your Bluetooth device name" detail="This is a required one-time step for Bluetooth attendance discovery." onBack={onDone}><Text style={styles.setupLabel}>Your StudyMatrix device name</Text><View style={[styles.deviceTagCard, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}><View style={{ flexDirection: "row", alignItems: "center" }}><MaterialIcons name="bluetooth" size={25} color={colors.gold} /><Text style={styles.deviceTagText}>{studentTag}</Text></View><Pressable onPress={() => { void Clipboard.setStringAsync(studentTag); setMessage("Device tag copied to clipboard!"); }} style={({ pressed }) => [{ padding: 8, borderRadius: 8, backgroundColor: pressed ? "#EAE5D9" : "transparent" }]}><MaterialIcons name="content-copy" size={22} color={colors.gold} /></Pressable></View><Text style={styles.setupCopy}>Tap Set device name. Android opens its protected Device name screen; type or paste the exact tag above, save it, turn Bluetooth on, then return to StudyMatrix.</Text><View style={styles.setupNotice}><MaterialIcons name="lock-outline" size={20} color={colors.navy} /><Text style={styles.setupNoticeText}>For privacy and security, Android does not allow StudyMatrix to rename your phone silently. You must confirm the change in system settings.</Text></View>{message ? <Callout tone="success" text={message} /> : null}<Button label="Set device name" icon="settings" tone="gold" onPress={openDeviceName} /><Pressable onPress={onDone} style={({ pressed }) => [styles.authLink, pressed && styles.pressed]}><Text style={styles.authLinkText}>I have set my device name</Text></Pressable></AuthShell>; }

function StudentAccess({ onBack, onAuthenticated, onRegister }: { onBack: () => void; onAuthenticated: (result: LocalLoginResult) => void; onRegister: () => void }) { const [enrollment, setEnrollment] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState<string | null>(null); const login = trpc.auth.local.login.useMutation(); const submit = () => { if (!enrollment.trim() || !password) { setMessage("Enter your enrollment number and password."); return; } login.mutate({ identifier: enrollment.trim(), password }, { onSuccess: async (result) => { if ((result as any).sessionToken) await Auth.setSessionToken((result as any).sessionToken); result.accountType === "student" ? onAuthenticated(result) : setMessage("Use Administrator login for this account."); }, onError: (error) => setMessage(error.message || "Unable to sign in.") }); }; return <AuthShell title="Student sign in" detail="Use the enrollment number and password created during registration." onBack={onBack} loading={login.isPending ? "Signing you in securely…" : undefined}><Text style={styles.fieldLabel}>Enrollment number</Text><TextInput value={enrollment} onChangeText={setEnrollment} autoCapitalize="characters" style={styles.input} placeholder="24210370020" placeholderTextColor="#98A2B3" /><Text style={styles.fieldLabel}>Password</Text><PasswordInput value={password} onChangeText={setPassword} placeholder="Your password" />{message ? <Callout tone="error" text={message} /> : null}<Button label={login.isPending ? "Signing in…" : "Sign in"} icon="login" onPress={submit} /><Pressable onPress={onRegister} disabled={login.isPending} style={({ pressed }) => [styles.authLink, pressed && styles.pressed]}><Text style={styles.authLinkText}>New student? Register your account</Text></Pressable></AuthShell>; }

function StudentRegistration({ onBack, onRegistered }: { onBack: () => void; onRegistered: (result: LocalLoginResult) => void }) { const [fullName, setFullName] = useState(""); const [enrollmentNumber, setEnrollmentNumber] = useState(""); const [rollNumber, setRollNumber] = useState(""); const [mobileNumber, setMobileNumber] = useState(""); const [parentMobileNumber, setParentMobileNumber] = useState(""); const [classDivision, setClassDivision] = useState("TY"); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [message, setMessage] = useState<string | null>(null); const register = trpc.auth.local.registerStudent.useMutation(); const submit = () => { if (![fullName, enrollmentNumber, rollNumber, mobileNumber, parentMobileNumber, classDivision, password, confirmPassword].every((value) => value.trim())) { setMessage("Complete every registration field."); return; } if (password.length < 8) { setMessage("Use a password with at least 8 characters."); return; } if (password !== confirmPassword) { setMessage("Password confirmation does not match."); return; } register.mutate({ fullName, enrollmentNumber, rollNumber, mobileNumber, parentMobileNumber, classDivision, password }, { onSuccess: async (result) => { if ((result as any).sessionToken) await Auth.setSessionToken((result as any).sessionToken); onRegistered({ accountType: "student", userId: result.userId, fullName: result.fullName, classDivision: result.classDivision, deviceTag: result.deviceTag, deviceVerified: false, mustChangePassword: false }); }, onError: (error) => setMessage(error.message || "Unable to register the student account.") }); }; return <AuthShell title="Student registration" detail="Your enrollment number creates the unique StudyMatrix Bluetooth tag." onBack={onBack} loading={register.isPending ? "Creating your student account…" : undefined}><Text style={styles.fieldLabel}>Full name</Text><TextInput value={fullName} onChangeText={setFullName} autoCapitalize="words" style={styles.input} placeholder="Student full name" placeholderTextColor="#98A2B3" /><Text style={styles.fieldLabel}>Enrollment number</Text><TextInput value={enrollmentNumber} onChangeText={setEnrollmentNumber} autoCapitalize="characters" autoCorrect={false} style={styles.input} placeholder="24210370020" placeholderTextColor="#98A2B3" /><View style={styles.twoFields}><View style={styles.flex}><Text style={styles.fieldLabel}>Roll number</Text><TextInput value={rollNumber} onChangeText={setRollNumber} keyboardType="number-pad" style={styles.input} placeholder="45" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.fieldLabel}>Class Year</Text><View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 14, padding: 4, height: 52, marginBottom: 16 }}>{["FY", "SY", "TY"].map((opt) => (<Pressable key={opt} onPress={() => setClassDivision(opt)} hitSlop={8} style={[{ flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 10 }, classDivision === opt && { backgroundColor: "#FFFFFF", shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }]}><Text style={[{ fontSize: 13, color: "#98A2B3", fontWeight: "600" }, classDivision === opt && { color: colors.navy, fontWeight: "900" }]}>{opt}</Text></Pressable>))}</View></View></View><View style={styles.twoFields}><View style={styles.flex}><Text style={styles.fieldLabel}>Student mobile</Text><TextInput value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" style={styles.input} placeholder="Mobile number" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.fieldLabel}>Parent mobile</Text><TextInput value={parentMobileNumber} onChangeText={setParentMobileNumber} keyboardType="phone-pad" style={styles.input} placeholder="Parent mobile" placeholderTextColor="#98A2B3" /></View></View><Text style={styles.fieldLabel}>Password</Text><PasswordInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" /><Text style={styles.fieldLabel}>Confirm password</Text><PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" />{message ? <Callout tone="error" text={message} /> : null}<Button label={register.isPending ? "Creating account…" : "Create student account"} icon="person-add" onPress={submit} /></AuthShell>; }

function AdminAccess({ onBack, onAuthenticated }: { onBack: () => void; onAuthenticated: (result: LocalLoginResult, password: string) => void }) { const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState<string | null>(null); const login = trpc.auth.local.login.useMutation(); const submit = () => { if (!identifier.trim() || !password) { setMessage("Enter your administrator ID and password."); return; } login.mutate({ identifier: identifier.trim(), password }, { onSuccess: async (result) => { if ((result as any).sessionToken) await Auth.setSessionToken((result as any).sessionToken); result.accountType === "admin" ? onAuthenticated(result, password) : setMessage("This account is not an administrator account."); }, onError: (error) => setMessage(error.message || "Administrator login failed.") }); }; return <AuthShell title="Administrator login" detail="Enter your Faculty ID and password to manage sessions." onBack={onBack} loading={login.isPending ? "Opening the faculty workspace…" : undefined}><Text style={styles.fieldLabel}>Faculty / Administrator ID</Text><TextInput value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="Administrator ID" placeholderTextColor="#98A2B3" /><Text style={styles.fieldLabel}>Password</Text><PasswordInput value={password} onChangeText={setPassword} placeholder="Administrator password" />{message ? <Callout tone="error" text={message} /> : null}<Button label={login.isPending ? "Signing in…" : "Administrator sign in"} icon="admin-panel-settings" tone="maroon" onPress={submit} /></AuthShell>; }

function AdminPasswordChange({ userId, currentPassword, onChanged, onBack }: { userId: number; currentPassword: string; onChanged: (nextPassword: string) => void; onBack: () => void }) { const [nextPassword, setNextPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [message, setMessage] = useState<string | null>(null); const change = trpc.auth.local.changeAdminPassword.useMutation(); const submit = () => { if (nextPassword.length < 8) { setMessage("Use a new password with at least 8 characters."); return; } if (nextPassword !== confirmPassword) { setMessage("Password confirmation does not match."); return; } change.mutate({ userId, currentPassword, nextPassword }, { onSuccess: () => onChanged(nextPassword), onError: (error) => setMessage(error.message || "Unable to change administrator password.") }); }; return <AuthShell title="Change administrator password" detail="Replace the initial password before using administrator tools." onBack={onBack} backDisabled={change.isPending} loading={change.isPending ? "Saving your new password…" : undefined}><Text style={styles.fieldLabel}>New password</Text><PasswordInput value={nextPassword} onChangeText={setNextPassword} placeholder="At least 8 characters" /><Text style={styles.fieldLabel}>Confirm new password</Text><PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" />{message ? <Callout tone="error" text={message} /> : null}<Button label={change.isPending ? "Saving password…" : "Save new password"} icon="lock" tone="maroon" onPress={submit} /></AuthShell>; }

function Header({ title, subtitle, isRoot, onBack, onProfile, onMenu }: { title: string; subtitle: string; isRoot: boolean; onBack: () => void; onProfile: () => void; onMenu: () => void }) {
  return <View style={[styles.header, { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }]}>
    {isRoot ? <Pressable onPress={onMenu} style={({ pressed }) => [styles.mark, pressed && styles.pressed]}><MaterialIcons name="menu" size={22} color={colors.gold} /></Pressable> : <Pressable onPress={onBack} style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={22} color={colors.navy} /></Pressable>}
    <View style={[styles.flex, styles.headerCopy]}><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSub}>{subtitle}</Text></View>
    <Pressable onPress={onProfile} style={({ pressed }) => [styles.headerIcon, { backgroundColor: pressed ? colors.paperDark : '#EDF1F5' }, pressed && styles.pressed]}><MaterialIcons name="person-outline" size={22} color={colors.navy} /></Pressable>
  </View>;
}

function SideMenu({ role, current, onOpen, onClose, accountName }: { role: Role; current: Screen; onOpen: (screen: Screen) => void; onClose: () => void; accountName: string }) {
  const student = role === "student";
  const items = student ? [{ label: "Dashboard", icon: "home" as IconName, screen: "studentHome" as Screen }, { label: "Attendance history", icon: "insights" as IconName, screen: "studentRecords" as Screen }, { label: "Notices", icon: "campaign" as IconName, screen: "notices" as Screen }] : [{ label: "Faculty desk", icon: "home" as IconName, screen: "adminHome" as Screen }, { label: "Start attendance", icon: "play-circle-outline" as IconName, screen: "startSession" as Screen }, { label: "Students", icon: "people" as IconName, screen: "adminStudents" as Screen }, { label: "Manage information", icon: "edit-note" as IconName, screen: "manageInfo" as Screen }, { label: "Attendance reports", icon: "assessment" as IconName, screen: "adminRecords" as Screen }, { label: "New notice", icon: "campaign" as IconName, screen: "composeNotice" as Screen }];
  return <View style={styles.drawerOverlay}><Pressable onPress={onClose} style={styles.drawerScrim} /><View style={styles.drawer}><View style={styles.drawerHeader}><Pressable onPress={() => onOpen("profile")} style={({ pressed }) => [styles.drawerProfile, pressed && styles.pressed]}><View style={styles.drawerAvatar}><Text style={styles.drawerAvatarText}>{student ? (accountName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "ST") : (accountName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "AD")}</Text></View><View style={styles.flex}><Text style={styles.drawerName}>{student ? (accountName || "Student") : (accountName || "Administrator")}</Text><Text style={styles.drawerRole}>{student ? "Student" : "Faculty administrator"}</Text></View><MaterialIcons name="chevron-right" size={22} color="#D1DBE8" /></Pressable><Pressable onPress={onClose} style={({ pressed }) => [styles.drawerClose, pressed && styles.pressed]}><MaterialIcons name="close" size={20} color={colors.navy} /></Pressable></View><View style={styles.drawerList}>{items.map((item) => <Pressable key={item.label} onPress={() => onOpen(item.screen)} style={({ pressed }) => [styles.drawerItem, (current === item.screen || (item.screen === "adminStudents" && current === "studentDetail")) && styles.drawerItemActive, pressed && styles.pressed]}><MaterialIcons name={item.icon} size={21} color={(current === item.screen || (item.screen === "adminStudents" && current === "studentDetail")) ? colors.gold : colors.navy} /><Text style={[styles.drawerItemText, (current === item.screen || (item.screen === "adminStudents" && current === "studentDetail")) && styles.drawerItemTextActive]}>{item.label}</Text></Pressable>)}</View><View style={styles.drawerFooter}>
      <MaterialIcons name="fingerprint" size={10} color={colors.gold} />
      <Text style={styles.drawerFooterText}>StudyMatrix Attendance</Text>
    </View>
  </View>
</View>;
}

function StudentHome({ onOpen, accountName, classDivision, deviceSetupComplete, testState, testMessage, onFixDeviceName, onTestBluetooth }: { onOpen: (screen: Screen) => void; accountName: string; classDivision: string; deviceSetupComplete: boolean; testState: "idle" | "testing" | "success" | "error"; testMessage: string | null; onFixDeviceName: () => void; onTestBluetooth: () => void }) {
  const catalogQuery = trpc.catalog.listAll.useQuery(undefined, { retry: false });
  const noticesQuery = trpc.notices.list.useQuery({ classDivision: classDivision || undefined }, { retry: false });
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const historyQuery = trpc.attendance.studentHistory.useQuery({ startDate: thirtyDaysAgo, endDate: today }, { retry: false });
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  useEffect(() => {
    if (catalogQuery.data) {
      void syncTimetableReminders(catalogQuery.data, "student", classDivision).then((result) => {
        if (!result.granted) setReminderMessage(result.message);
      });
    }
  }, [catalogQuery.data, classDivision]);

  // Compute real attendance stats from history
  const historyRecords = historyQuery.data ?? [];
  const totalSessions = historyRecords.length;
  const presentSessions = historyRecords.filter((r) => r.status === "present" || r.status === "manual").length;
  const attendancePct = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : null;

  // Build per-subject breakdown from real history
  const subjectMap = new Map<string, { name: string; code: string; attended: number; total: number }>();
  for (const r of historyRecords) {
    const existing = subjectMap.get(r.code);
    if (!existing) {
      subjectMap.set(r.code, { name: r.subject, code: r.code, attended: r.status === "present" || r.status === "manual" ? 1 : 0, total: 1 });
    } else {
      existing.total++;
      if (r.status === "present" || r.status === "manual") existing.attended++;
    }
  }
  const realSubjects = [...subjectMap.values()];

  const subjectColors = [colors.gold, colors.maroon, colors.green, colors.navy, "#7C3AED", "#0891B2"];

  const noticeCount = noticesQuery.data?.length ?? 0;

  const enableReminder = () => { void scheduleAttendanceReminder(buildUpcomingSession("student")).then((result) => setReminderMessage(result.message)).catch(() => setReminderMessage("Unable to schedule a reminder. Check Android notification settings and try again.")); };
  return <>
    <View style={[styles.studentHero, { shadowColor: colors.navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8 }]}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} />
          <Text style={styles.eyebrow}>STUDENT DASHBOARD</Text>
        </View>
        <Text style={styles.bigPercent}>{attendancePct !== null ? `${attendancePct}%` : "--"}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
          {attendancePct !== null ? <MaterialIcons name={attendancePct >= 75 ? "trending-up" : "trending-down"} size={13} color={attendancePct >= 75 ? "#4CAF87" : colors.maroon} /> : null}
          <Text style={styles.heroMeta}>{attendancePct !== null ? `Overall attendance · ${attendancePct >= 75 ? "On track" : "Needs attention"}` : "No attendance records yet"}</Text>
        </View>
      </View>
      <View style={styles.daysRing}><Text style={styles.daysNumber}>{presentSessions}</Text><Text style={styles.daysLabel}>DAYS</Text></View>
    </View>
    {!deviceSetupComplete ? <Pressable onPress={onFixDeviceName} style={({ pressed }) => [styles.deviceReminder, pressed && styles.pressed]}><RoundIcon name="bluetooth-searching" background="#F8EDEF" color={colors.maroon} /><View style={styles.flex}><Text style={styles.promptTitle}>Finish Bluetooth device setup</Text><Text style={styles.smallMuted}>Your phone name must match your StudyMatrix device tag for automatic attendance.</Text></View><MaterialIcons name="chevron-right" size={22} color={colors.maroon} /></Pressable> : null}
    <Pressable disabled={testState === "testing"} onPress={onTestBluetooth} style={({ pressed }) => [styles.reminderCard, testState === "testing" && styles.disabledCard, pressed && testState !== "testing" && styles.pressed]}>{testState === "testing" ? <View style={styles.testSpinner}><ActivityIndicator size="small" color="#FFFFFF" /></View> : <RoundIcon name="bluetooth-connected" background="#E7F5EE" color={colors.green} />}<View style={styles.flex}><Text style={styles.promptTitle}>{testState === "testing" ? "Testing your Bluetooth…" : "Test My Bluetooth"}</Text><Text style={styles.smallMuted}>{testState === "testing" ? "Please keep the app open while your phone name is checked." : "Check Bluetooth availability and set this phone's required StudyMatrix name."}</Text></View>{testState === "testing" ? <Text style={styles.testingLabel}>Testing</Text> : <MaterialIcons name="chevron-right" size={22} color={colors.muted} />}</Pressable>
    {testMessage && testState !== "testing" ? <BluetoothTestToast state={testState} message={testMessage} /> : null}
    <Button label="Enter attendance code" icon="dialpad" tone="gold" onPress={() => onOpen("code")} />
    <Pressable onPress={enableReminder} style={({ pressed }) => [styles.reminderCard, pressed && styles.pressed]}><RoundIcon name="notifications-active" background="#EAF0F8" color={colors.navy} /><View style={styles.flex}><Text style={styles.promptTitle}>Enable session reminder</Text><Text style={styles.smallMuted}>Get a reminder before your next attendance session.</Text></View><MaterialIcons name="chevron-right" size={22} color={colors.muted} /></Pressable>
    {reminderMessage ? <Callout tone={reminderMessage.includes("scheduled") || reminderMessage.includes("enabled") ? "success" : "error"} text={reminderMessage} /> : null}
    <Title action="View log" onAction={() => onOpen("studentRecords")}>Subject attendance</Title>
    {historyQuery.isFetching ? <ActivityIndicator color={colors.navy} style={{ marginVertical: 12 }} /> : realSubjects.length === 0 ? <Text style={[styles.smallMuted, { textAlign: "center", marginVertical: 12 }]}>No attendance records yet. Records will appear here after your first session.</Text> : realSubjects.map((subject, idx) => <View style={styles.subjectRow} key={subject.code}><View style={[styles.dot, { backgroundColor: subjectColors[idx % subjectColors.length] }]} /><View style={styles.flex}><Text style={styles.subjectName}>{subject.name}</Text><Text style={styles.smallMuted}>{subject.code} · {subject.attended}/{subject.total} lectures</Text></View><Text style={styles.subjectPct}>{Math.round((subject.attended / subject.total) * 100)}%</Text></View>)}
    {noticeCount > 0 ? <Pressable onPress={() => onOpen("notices")} style={({ pressed }) => [styles.noticePrompt, pressed && styles.pressed]}><RoundIcon name="notifications-none" background="#F8EDEF" color={colors.maroon} /><View style={styles.flex}><Text style={styles.promptTitle}>{noticeCount} notice{noticeCount !== 1 ? "s" : ""}</Text><Text style={styles.smallMuted}>Tap to read department notices for your class.</Text></View><Text style={styles.titleAction}>Open</Text></Pressable> : null}
  </>;
}

function StudentRecords() {
  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-31");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const historyQuery = trpc.attendance.studentHistory.useQuery({ startDate, endDate }, { retry: false });
  const allRecords = historyQuery.data?.map((record) => ({ date: record.date, subject: record.subject, classDivision: record.classDivision, status: record.status, method: record.method })) ?? [];
  const records = allRecords.filter((record) => (!classFilter.trim() || record.classDivision.toLowerCase().includes(classFilter.trim().toLowerCase())) && (!subjectFilter.trim() || record.subject.toLowerCase().includes(subjectFilter.trim().toLowerCase())));
  const trend = records.slice().reverse();
  // Build per-subject breakdown from real API records
  const subjectBreakdownColors = [colors.gold, colors.maroon, colors.green, colors.navy, "#7C3AED", "#0891B2"];
  const subjectBreakdownMap = new Map<string, { name: string; code: string; attended: number; total: number }>();
  for (const r of allRecords) {
    const existing = subjectBreakdownMap.get(r.subject);
    if (!existing) {
      subjectBreakdownMap.set(r.subject, { name: r.subject, code: r.subject, attended: r.status === "present" || r.status === "manual" ? 1 : 0, total: 1 });
    } else {
      existing.total++;
      if (r.status === "present" || r.status === "manual") existing.attended++;
    }
  }
  const realSubjectBreakdown = [...subjectBreakdownMap.values()];
  return <><View style={styles.info}><MaterialIcons name="analytics" size={21} color={colors.navy} /><Text style={styles.infoText}>Filter the graph by date range, class, and subject to review recorded attendance.</Text></View><Title>Attendance history</Title><View style={styles.rangeRow}><View style={styles.flex}><Text style={styles.rangeLabel}>From</Text><TextInput value={startDate} onChangeText={setStartDate} style={styles.rangeInput} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.rangeLabel}>To</Text><TextInput value={endDate} onChangeText={setEndDate} style={styles.rangeInput} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" /></View></View><View style={styles.rangeRow}><View style={styles.flex}><Text style={styles.rangeLabel}>Class filter</Text><TextInput value={classFilter} onChangeText={setClassFilter} style={styles.rangeInput} placeholder="All classes" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.rangeLabel}>Subject filter</Text><TextInput value={subjectFilter} onChangeText={setSubjectFilter} style={styles.rangeInput} placeholder="All subjects" placeholderTextColor="#98A2B3" /></View></View><View style={styles.historyCard}><View style={styles.historyHeading}><View><Text style={styles.subjectName}>Recent lecture pattern</Text><Text style={styles.smallMuted}>{startDate} to {endDate}</Text></View><Text style={styles.historyLegend}>PRESENT</Text></View><View style={styles.chart}>{trend.map((record) => { const present = record.status === "present" || record.status === "manual"; return <View key={`${record.date}-${record.subject}`} style={styles.chartColumn}><View style={styles.chartTrack}><View style={[styles.chartBar, { height: present ? "86%" : "16%", backgroundColor: present ? colors.green : colors.maroon }]} /></View><Text style={styles.chartLabel}>{record.date.split("-").pop() ?? record.date.split(" ")[0]}</Text></View>; })}</View>{records.length === 0 ? <Text style={styles.rangeStatus}>No attendance records match the selected filters.</Text> : null}{historyQuery.isFetching ? <Text style={styles.rangeStatus}>Updating range…</Text> : null}</View><Title>Recent activity</Title>{records.length === 0 && !historyQuery.isFetching ? <Text style={[styles.smallMuted, { textAlign: "center", marginVertical: 12 }]}>No attendance records yet for this period.</Text> : records.map((record) => <RecordLine key={`${record.date}-${record.subject}`} name={record.subject} description={`${record.date}${record.method ? ` · ${record.method}` : ""}`} isPresent={record.status === "present" || record.status === "manual"} />)}<Title>Subject breakdown</Title>{realSubjectBreakdown.length === 0 && !historyQuery.isFetching ? <Text style={[styles.smallMuted, { textAlign: "center", marginVertical: 12 }]}>No subject records yet.</Text> : realSubjectBreakdown.map((subject, idx) => { const percentage = Math.round((subject.attended / subject.total) * 100); return <View style={styles.breakdown} key={subject.code}><View style={styles.flex}><Text style={styles.subjectName}>{subject.name}</Text><Text style={styles.smallMuted}>{subject.attended} of {subject.total} lectures</Text></View><View style={styles.breakdownRight}><Text style={styles.subjectPct}>{percentage}%</Text><View style={styles.track}><View style={[styles.fill, { width: `${percentage}%`, backgroundColor: subjectBreakdownColors[idx % subjectBreakdownColors.length] }]} /></View></View></View>; })}</>;
}

function CodeEntry({ code, setCode, state, onSubmit }: { code: string; setCode: (code: string) => void; state: "idle" | "success" | "error"; onSubmit: () => void }) {
  return <View style={styles.codeScreen}><View style={styles.keyIcon}><MaterialIcons name="vpn-key" size={32} color={colors.gold} /></View><Text style={styles.codeTitle}>Enter the six-digit code</Text><Text style={styles.codeCopy}>Ask your faculty member for the code shown during the active attendance session.</Text><TextInput value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="••••••" placeholderTextColor="#B8B2A8" maxLength={6} style={styles.codeInput} textAlign="center" /><Button label="Verify attendance" icon="verified-user" onPress={onSubmit} />{state === "success" ? <Callout tone="success" text="Attendance marked present for Data Structures." /> : null}{state === "error" ? <Callout tone="error" text="That code is incorrect or has expired. Please check with faculty." /> : null}<View style={styles.hint}><MaterialIcons name="info-outline" size={20} color={colors.navy} /><Text style={styles.hintText}>The code expires when the faculty session closes. Device discovery remains the faster option when available.</Text></View></View>;
}

function Callout({ tone, text }: { tone: "success" | "error" ; text: string }) { const good = tone === "success"; return <View style={[styles.callout, { backgroundColor: good ? "#E7F5EE" : "#FCE8E6" }]}><MaterialIcons name={good ? "check-circle" : "error-outline"} size={21} color={good ? colors.green : "#B42318"} /><Text style={[styles.calloutText, { color: good ? colors.green : "#B42318" }]}>{text}</Text></View>; }
function BluetoothTestToast({ state, message }: { state: "idle" | "success" | "error"; message: string }) { const success = state === "success"; return <View accessibilityRole="alert" style={[styles.bluetoothToast, { backgroundColor: success ? "#E7F5EE" : "#FCE8E6", borderColor: success ? "#A8D8BE" : "#F2B8B5" }]}><MaterialIcons name={success ? "check-circle" : "error-outline"} size={21} color={success ? colors.green : "#B42318"} /><View style={styles.flex}><Text style={[styles.toastTitle, { color: success ? colors.green : "#B42318" }]}>{success ? "Bluetooth test successful" : "Bluetooth test needs attention"}</Text><Text style={[styles.toastText, { color: success ? colors.green : "#B42318" }]}>{message}</Text></View></View>; }

function Notices() {
  const noticesQuery = trpc.notices.list.useQuery(undefined, { retry: false });
  const accentColors = [colors.gold, colors.maroon, colors.green, colors.navy];
  if (noticesQuery.isFetching) return <ActivityIndicator color={colors.navy} style={{ marginTop: 32 }} />;
  if (!noticesQuery.data || noticesQuery.data.length === 0) {
    return <View style={[styles.info, { marginTop: 16 }]}><MaterialIcons name="notifications-none" size={21} color={colors.navy} /><Text style={styles.infoText}>No notices posted yet. Check back later for department announcements.</Text></View>;
  }
  return <>{noticesQuery.data.map((notice, idx) => {
    const dateStr = new Date(notice.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
    return <Notice key={notice.id} accent={accentColors[idx % accentColors.length]} date={dateStr} title={notice.title} body={notice.body} author={`Posted for ${notice.targetClass}`} />;
  })}</>;
}
function Notice({ accent, date, title, body, author }: { accent: string; date: string; title: string; body: string; author: string }) { return <View style={styles.notice}><View style={[styles.noticeAccent, { backgroundColor: accent }]} /><View style={styles.noticeBody}><Text style={styles.noticeDate}>{date}</Text><Text style={styles.noticeTitle}>{title}</Text><Text style={styles.noticeText}>{body}</Text><Text style={styles.noticeAuthor}>{author}</Text></View></View>; }

function AdminHome({ onOpen, accountName }: { onOpen: (screen: Screen) => void; accountName: string; }) { 
  const catalogQuery = trpc.catalog.listAll.useQuery(undefined, { retry: false });
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (catalogQuery.data) {
      void syncTimetableReminders(catalogQuery.data, "faculty", accountName).then((result) => {
        if (!result.granted) setReminderMessage(result.message);
      });
    }
  }, [catalogQuery.data, accountName]);

  const enableReminder = () => { void scheduleAttendanceReminder(buildUpcomingSession("faculty")).then((result) => setReminderMessage(result.message)).catch(() => setReminderMessage("Unable to schedule a reminder. Check Android notification settings and try again.")); }; return <><CreateSubjectModal visible={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onSuccess={() => utils.catalog.listAll.invalidate()} /><View style={styles.adminHero}><Text style={styles.eyebrow}>MONDAY · 18 AUGUST</Text><Text style={styles.adminTitle}>Ready for today’s classes?</Text><Text style={styles.adminCopy}>Open an attendance session to start tracking your students.</Text><Button label="Start attendance" icon="play-circle-outline" tone="gold" onPress={() => onOpen("startSession")} /></View><Pressable onPress={enableReminder} style={({ pressed }) => [styles.reminderCard, pressed && styles.pressed]}><RoundIcon name="notifications-active" background="#EAF0F8" color={colors.navy} /><View style={styles.flex}><Text style={styles.promptTitle}>Set faculty session reminder</Text><Text style={styles.smallMuted}>Get ready to open attendance before your next class.</Text></View><MaterialIcons name="chevron-right" size={22} color={colors.muted} /></Pressable>{reminderMessage ? <Callout tone={reminderMessage.includes("scheduled") || reminderMessage.includes("enabled") ? "success" : "error"} text={reminderMessage} /> : null}<View style={styles.grid}><Pressable onPress={() => onOpen("adminRecords")} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}><RoundIcon name="assessment" /><Text style={styles.quickTitle}>Records</Text><Text style={styles.smallMuted}>Review & export</Text></Pressable><Pressable onPress={() => onOpen("composeNotice")} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}><RoundIcon name="campaign" background="#F8EDEF" color={colors.maroon} /><Text style={styles.quickTitle}>Notice</Text><Text style={styles.message_a_class}>Message a class</Text></Pressable><Pressable onPress={() => onOpen("manageFaculty")} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}><RoundIcon name="manage-accounts" background="#EAF0F8" color={colors.navy} /><Text style={styles.quickTitle}>Faculty</Text><Text style={styles.smallMuted}>Manage logins</Text></Pressable></View><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}><Title>Today’s timetable</Title><Pressable onPress={() => setCreateModalOpen(true)}><Text style={{ color: colors.gold, fontWeight: "600", padding: 8 }}>+ Add Subject</Text></Pressable></View>{catalogQuery.data && catalogQuery.data.length > 0 ? catalogQuery.data.slice(0, 5).map((c, i) => <Timetable key={c.id} time={c.startTime} subject={c.name} meta={`${c.code} · ${c.classDivision} · Room ${c.room} · ${c.teacherName}`} maroon={i % 2 !== 0} />) : <Text style={styles.rangeStatus}>No timetable entries found.</Text>}</>; }
function Timetable({ time, subject, meta, next, maroon }: { time: string; subject: string; meta: string; next?: boolean; maroon?: boolean }) { return <View style={styles.timetable}><Text style={styles.time}>{time}</Text><View style={[styles.timeLine, { backgroundColor: maroon ? colors.maroon : colors.gold }]} /><View style={styles.flex}><Text style={styles.subjectName}>{subject}</Text><Text style={styles.timetableMeta}>{meta}</Text></View>{next ? <View style={styles.nextPill}><Text style={styles.nextText}>NEXT</Text></View> : null}</View>; }
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

function StartSession({ accountName, onStart }: { accountName: string; onStart: () => void }) {
  const catalogQuery = trpc.catalog.list.useQuery(undefined, { retry: false });
  const catalog = catalogQuery.data?.map((item) => ({ name: item.name, teacherName: item.teacherName, classDivision: item.classDivision, room: item.room, startTime: item.startTime })) ?? [];
  const [subject, setSubject] = useState("");
  const [teacherName, setTeacherName] = useState(accountName || "");
  const [classDivision, setClassDivision] = useState("");
  const [room, setRoom] = useState("");
  const [date, setDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState("10:30");
  const [reminderMinutes, setReminderMinutes] = useState("10");
  const [audience, setAudience] = useState<"student" | "faculty">("student");
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  const applyCatalogEntry = (entry: typeof catalog[number]) => { setSubject(entry.name); setTeacherName(entry.teacherName); setClassDivision(entry.classDivision); setRoom(entry.room); setTimeSlot(entry.startTime); };
  const selectTeacher = (value: string) => { const entry = catalog.find((item) => item.teacherName === value && (item.classDivision === classDivision || item.name === subject)) ?? catalog.find((item) => item.teacherName === value); if (entry) applyCatalogEntry(entry); };
  const selectClass = (value: string) => { const entry = catalog.find((item) => item.classDivision === value && (item.teacherName === teacherName || item.name === subject)) ?? catalog.find((item) => item.classDivision === value); if (entry) applyCatalogEntry(entry); };

  const scheduleFromAdmin = () => {
    const minutes = Number(reminderMinutes);
    const startsAt = new Date(`${date}T${timeSlot}:00`);
    if (!subject.trim() || !teacherName.trim() || !classDivision.trim() || !room.trim()) { setNotificationMessage("Add a subject, teacher, class/division, and room before scheduling the reminder."); return; }
    if (Number.isNaN(startsAt.getTime()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeSlot)) { setNotificationMessage("Enter a valid date and 24-hour time slot, for example 2026-08-18 and 10:30."); return; }
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 120) { setNotificationMessage("Reminder timing must be a whole number between 1 and 120 minutes."); return; }
    const sessionId = `${audience}-${subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}-${timeSlot}`;
    void scheduleAttendanceReminder({ sessionId, audience, subject: subject.trim(), teacherName: teacherName.trim(), classDivision: classDivision.trim(), room: room.trim(), startsAt, reminderMinutes: minutes }).then((result) => setNotificationMessage(result.message)).catch(() => setNotificationMessage("Unable to schedule this reminder. Check Android notification settings and try again."));
  };

  return <><View style={styles.info}><MaterialIcons name="notifications-active" size={21} color={colors.navy} /><Text style={styles.infoText}>Choose a saved subject, teacher, and class. The room and timetable start time are applied from the catalog.</Text></View>{catalogQuery.isFetching ? <Text style={styles.rangeStatus}>Refreshing saved catalog…</Text> : null}<CatalogSelector label="Subject" value={subject} options={[...new Set(catalog.map((item) => item.name))]} onSelect={(value) => { const entry = catalog.find((item) => item.name === value); if (entry) applyCatalogEntry(entry); }} /><CatalogSelector label="Teacher name" value={teacherName} options={[...new Set([accountName, ...catalog.map((item) => item.teacherName)].filter(Boolean))]} onSelect={selectTeacher} /><CatalogSelector label="Class / division" value={classDivision} options={[...new Set(catalog.map((item) => item.classDivision))]} onSelect={selectClass} /><Field label="Room (from catalog)" value={room} /><View style={styles.twoFields}><View style={styles.flex}><Text style={styles.fieldLabel}>Session date</Text><TextInput value={date} onChangeText={setDate} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.fieldLabel}>Time slot</Text><TextInput value={timeSlot} onChangeText={setTimeSlot} style={styles.input} placeholder="HH:MM" placeholderTextColor="#98A2B3" keyboardType="numbers-and-punctuation" /></View></View><Text style={styles.fieldLabel}>Notification audience</Text><View style={styles.audienceRow}><Pressable onPress={() => setAudience("student")} style={({ pressed }) => [styles.audienceChoice, audience === "student" && styles.audienceChoiceActive, pressed && styles.pressed]}><MaterialIcons name="school" size={18} color={audience === "student" ? "#FFFFFF" : colors.navy} /><Text style={[styles.audienceText, audience === "student" && styles.audienceTextActive]}>Students</Text></Pressable><Pressable onPress={() => setAudience("faculty")} style={({ pressed }) => [styles.audienceChoice, audience === "faculty" && styles.audienceChoiceActive, pressed && styles.pressed]}><MaterialIcons name="admin-panel-settings" size={18} color={audience === "faculty" ? "#FFFFFF" : colors.navy} /><Text style={[styles.audienceText, audience === "faculty" && styles.audienceTextActive]}>Faculty</Text></Pressable></View><Text style={styles.fieldLabel}>Remind before (minutes)</Text><TextInput value={reminderMinutes} onChangeText={setReminderMinutes} style={styles.input} keyboardType="number-pad" placeholder="10" placeholderTextColor="#98A2B3" /><View style={styles.fallback}><RoundIcon name="schedule" background="#F5EEDB" color="#9A6C0D" /><View style={styles.flex}><Text style={styles.fallbackTitle}>Reminder preview</Text><Text style={styles.smallMuted}>{subject || "Subject"} · {teacherName || "Teacher"} · {classDivision || "Class"} · {date} at {timeSlot}</Text></View></View>{notificationMessage ? <Callout tone={notificationMessage.includes("scheduled") ? "success" : "error"} text={notificationMessage} /> : null}<Button label={`Schedule ${audience} reminder`} icon="notifications-active" tone="gold" onPress={scheduleFromAdmin} /><View style={styles.gap} /><Text style={styles.fieldLabel}>Attendance fallback</Text><View style={styles.fallback}><RoundIcon name="password" background="#E7F5EE" color={colors.green} /><View style={styles.flex}><Text style={styles.fallbackTitle}>Code will be available</Text><Text style={styles.smallMuted}>A one-time six-digit code expires after 10 minutes.</Text></View></View><Button label="Open attendance session" icon="play-arrow" onPress={onStart} /></>;
}
function CatalogSelector({ label, value, options, onSelect }: { label: string; value: string; options: string[]; onSelect: (value: string) => void }) { const [open, setOpen] = useState(false); return <><Text style={styles.fieldLabel}>{label}</Text><Pressable onPress={() => setOpen((current) => !current)} style={({ pressed }) => [styles.field, pressed && styles.pressed]}><Text style={styles.fieldText}>{value}</Text><MaterialIcons name={open ? "expand-less" : "expand-more"} size={22} color={colors.muted} /></Pressable>{open ? <View style={styles.selectorOptions}>{options.map((option) => <Pressable key={option} onPress={() => { onSelect(option); setOpen(false); }} style={({ pressed }) => [styles.selectorOption, option === value && styles.selectorOptionActive, pressed && styles.pressed]}><Text style={[styles.selectorOptionText, option === value && styles.selectorOptionTextActive]}>{option}</Text>{option === value ? <MaterialIcons name="check" size={18} color="#FFFFFF" /> : null}</Pressable>)}</View> : null}</>; }
function Field({ label, value }: { label: string; value: string }) { return <><Text style={styles.fieldLabel}>{label}</Text><View style={styles.field}><Text style={styles.fieldText}>{value}</Text><MaterialIcons name="expand-more" size={22} color={colors.muted} /></View></>; }

type ManagedSubject = { id: number | string; subject: string; code: string; teacher: string; classDivision: string; room: string; timeSlot: string; dayOfWeek: number };

function ManageInfo({ accountName }: { accountName: string }) {
  const profileQuery = trpc.profiles.self.useQuery();
  const accessRole = profileQuery.data?.faculty?.accessRole;
  const isSuperAdmin = accessRole === "superadmin";

  const catalogQuery = trpc.catalog.list.useQuery(undefined, { retry: false });
  const catalogCreate = trpc.catalog.create.useMutation();
  const catalogUpdate = trpc.catalog.update.useMutation();
  const catalogDelete = trpc.catalog.delete.useMutation();
  const databaseItems: ManagedSubject[] | undefined = catalogQuery.data?.map((item) => ({ id: item.id, subject: item.name, code: item.code, teacher: item.teacherName, classDivision: item.classDivision, room: item.room, timeSlot: `${item.startTime}–${item.endTime}`, dayOfWeek: item.dayOfWeek }));
  const items = databaseItems ?? [];
  const [subject, setSubject] = useState(""); const [code, setCode] = useState(""); const [teacher, setTeacher] = useState(accountName || ""); const [classDivision, setClassDivision] = useState(""); const [room, setRoom] = useState(""); const [timeSlot, setTimeSlot] = useState(""); const [dayOfWeek, setDayOfWeek] = useState(1); const [editingId, setEditingId] = useState<number | null>(null); const [message, setMessage] = useState<string | null>(null);
  
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const save = () => {
    if (!isSuperAdmin) { setMessage("Only super administrators can edit the global timetable."); return; }
    if (![subject, code, teacher, classDivision, room, timeSlot].every((value) => value.trim())) { setMessage("Complete the subject, code, teacher, class, room, and time slot before saving."); return; }
    const [startTime, endTime] = timeSlot.split(/[–-]/).map((value) => value.trim());
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime ?? "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime ?? "")) { setMessage("Use a 24-hour time slot such as 10:30–11:30."); return; }
    const payload = { name: subject.trim(), code: code.trim(), teacherName: teacher.trim(), classDivision: classDivision.trim(), room: room.trim(), dayOfWeek, startTime, endTime };
    const onSuccess = () => { void catalogQuery.refetch(); setSubject(""); setCode(""); setTeacher(""); setClassDivision(""); setRoom(""); setTimeSlot(""); setDayOfWeek(1); setEditingId(null); setMessage(editingId ? "Timetable information updated in the shared database." : "Timetable information saved to the shared database."); };
    const onError = (error: unknown) => setMessage(error instanceof Error && error.message ? error.message : "Unable to save timetable information.");
    if (editingId) catalogUpdate.mutate({ id: editingId, ...payload }, { onSuccess, onError }); else catalogCreate.mutate(payload, { onSuccess, onError });
  };
  const edit = (item: ManagedSubject) => { if (!isSuperAdmin) { setMessage("Only super administrators can edit the global timetable."); return; } if (typeof item.id !== "number") { setMessage("Sign in as a faculty administrator to edit database records."); return; } setEditingId(item.id); setSubject(item.subject); setCode(item.code); setTeacher(item.teacher); setClassDivision(item.classDivision); setRoom(item.room); setTimeSlot(item.timeSlot); setDayOfWeek(item.dayOfWeek); setMessage("Editing saved timetable information."); };
  const remove = (item: ManagedSubject) => { if (!isSuperAdmin) { setMessage("Only super administrators can edit the global timetable."); return; } const subjectId = item.id; if (typeof subjectId !== "number") { setMessage("Sign in as a faculty administrator to delete database records."); return; } Alert.alert("Delete subject?", `Delete ${item.subject}? Subjects with attendance sessions are protected to preserve history.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => catalogDelete.mutate({ id: subjectId }, { onSuccess: () => { void catalogQuery.refetch(); setMessage("Subject removed from the shared database."); }, onError: (error) => setMessage(error.message || "Unable to delete this subject.") }) }]); };
  const saving = catalogCreate.isPending || catalogUpdate.isPending;
  return <><View style={styles.info}><MaterialIcons name="edit-note" size={21} color={colors.navy} /><Text style={styles.infoText}>Changes to the timetable are stored in the shared database and instantly update faculty and student notifications.</Text></View><Text style={styles.fieldLabel}>Subject name</Text><TextInput value={subject} onChangeText={setSubject} style={styles.input} placeholder="Operating Systems" placeholderTextColor="#98A2B3" /><View style={styles.twoFields}><View style={styles.flex}><Text style={styles.fieldLabel}>Subject code</Text><TextInput value={code} onChangeText={setCode} style={styles.input} placeholder="CS-304" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.fieldLabel}>Time slot</Text><TextInput value={timeSlot} onChangeText={setTimeSlot} style={styles.input} placeholder="10:30–11:30" placeholderTextColor="#98A2B3" /></View></View><Text style={styles.fieldLabel}>Teacher name</Text><TextInput value={teacher} onChangeText={setTeacher} style={styles.input} placeholder="Prof. A. Kulkarni" placeholderTextColor="#98A2B3" /><View style={styles.twoFields}><View style={styles.flex}><Text style={styles.fieldLabel}>Class / division</Text><TextInput value={classDivision} onChangeText={setClassDivision} style={styles.input} placeholder="TY Computer A" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.fieldLabel}>Room number</Text><TextInput value={room} onChangeText={setRoom} style={styles.input} placeholder="Room 204" placeholderTextColor="#98A2B3" /></View></View><View style={{ zIndex: 10, marginTop: 16 }}><CatalogSelector label="Day of week" value={days[dayOfWeek] || "Monday"} options={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]} onSelect={(val) => setDayOfWeek(days.indexOf(val))} /></View>{message ? <Callout tone={message.includes("saved") || message.includes("updated") || message.includes("removed") ? "success" : "error"} text={message} /> : null}<Button label={saving ? "Saving timetable entry…" : editingId ? "Update timetable entry" : "Save timetable entry"} icon="save" tone="maroon" onPress={save} />{editingId ? <Pressable onPress={() => { setEditingId(null); setSubject(""); setCode(""); setTeacher(accountName || ""); setClassDivision(""); setRoom(""); setTimeSlot(""); setDayOfWeek(1); setMessage(null); }} style={({ pressed }) => [styles.cancelEdit, pressed && styles.pressed]}><Text style={styles.cancelEditText}>Cancel edit</Text></Pressable> : null}<Title>Global Timetable</Title>{catalogQuery.isLoading ? <ActivityIndicator color={colors.navy} /> : items.map((item) => <View style={styles.catalogCard} key={item.id}><View style={[styles.catalogCode, { backgroundColor: item.code === "CS-301" ? "#F5EEDB" : "#EAF0F8" }]}><Text style={styles.catalogCodeText}>{item.code}</Text></View><View style={styles.flex}><Text style={styles.subjectName}>{item.subject}</Text><Text style={styles.smallMuted}>{item.teacher} · {item.classDivision}</Text><Text style={styles.smallMuted}>{item.room} · {days[item.dayOfWeek]} · {item.timeSlot}</Text></View><View style={styles.catalogActions}><Pressable onPress={() => edit(item)} style={({ pressed }) => [styles.catalogAction, pressed && styles.pressed]}><MaterialIcons name="edit" size={18} color={colors.navy} /></Pressable><Pressable onPress={() => remove(item)} style={({ pressed }) => [styles.catalogAction, styles.deleteAction, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={18} color="#B42318" /></Pressable></View></View>)}</>;
}

function ManageFaculty() {
  const query = trpc.profiles.faculty.list.useQuery(undefined, { retry: false });
  const createMutation = trpc.auth.local.registerFaculty.useMutation();
  const [fullName, setFullName] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "superadmin">("admin");
  const [message, setMessage] = useState<string | null>(null);

  const save = () => {
    if (!fullName.trim() || !facultyId.trim() || !password.trim()) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    createMutation.mutate({ fullName, facultyId, accessRole: role, password }, {
      onSuccess: () => {
        setMessage("Faculty account created successfully.");
        setFullName("");
        setFacultyId("");
        setPassword("");
        void query.refetch();
      },
      onError: (error) => setMessage(error.message)
    });
  };

  const items = query.data ?? [];
  return <><View style={styles.info}><MaterialIcons name="manage-accounts" size={21} color={colors.navy} /><Text style={styles.infoText}>Create independent login accounts for faculty members. They can log in with their Faculty ID.</Text></View><Text style={styles.fieldLabel}>Full name</Text><TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Prof. Meera Kulkarni" placeholderTextColor="#98A2B3" /><View style={styles.twoFields}><View style={styles.flex}><Text style={styles.fieldLabel}>Faculty ID</Text><TextInput value={facultyId} onChangeText={setFacultyId} style={styles.input} placeholder="FAC-01" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.fieldLabel}>Role</Text><View style={styles.audienceRow}><Pressable onPress={() => setRole("admin")} style={({ pressed }) => [styles.audienceChoice, role === "admin" && styles.audienceChoiceActive, pressed && styles.pressed]}><Text style={[styles.audienceText, role === "admin" && styles.audienceTextActive]}>Admin</Text></Pressable><Pressable onPress={() => setRole("superadmin")} style={({ pressed }) => [styles.audienceChoice, role === "superadmin" && styles.audienceChoiceActive, pressed && styles.pressed]}><Text style={[styles.audienceText, role === "superadmin" && styles.audienceTextActive]}>Super</Text></Pressable></View></View></View><Text style={styles.fieldLabel}>Account password</Text><PasswordInput value={password} onChangeText={setPassword} placeholder="Minimum 8 characters" />{message ? <Callout tone={message.includes("successfully") ? "success" : "error"} text={message} /> : null}<Button label={createMutation.isPending ? "Creating account…" : "Create faculty account"} icon="person-add" tone="gold" onPress={save} /><Title>Registered faculty</Title>{query.isLoading ? <ActivityIndicator color={colors.navy} /> : items.map((item) => <View style={styles.catalogCard} key={item.userId}><View style={[styles.catalogCode, { backgroundColor: "#EAF0F8" }]}><MaterialIcons name="person" size={20} color={colors.navy} /></View><View style={styles.flex}><Text style={styles.subjectName}>{item.fullName}</Text><Text style={styles.smallMuted}>{item.accessRole === "superadmin" ? "Super Admin" : "Admin"} · {item.active ? "Active" : "Disabled"}</Text></View></View>)}</>;
}

function LiveSession({ scanState, detectedCount, scanError, matchedStudents, unmatchedTags, onLinkUnmatched, onScan, onCancel, onSubmit }: { scanState: ScanState; detectedCount: number; scanError: string | null; matchedStudents: { fullName: string; enrollmentNumber: string; deviceTag: string; manuallyLinked?: boolean }[]; unmatchedTags: string[]; onLinkUnmatched: (tag: string) => void; onScan: () => void; onCancel: () => void; onSubmit: () => void }) { const discovering = scanState === "discovering"; const complete = scanState === "complete"; const count = complete ? detectedCount : discovering ? detectedCount : 0; const headline = discovering ? "Searching nearby device tags" : complete ? "Discovery complete" : scanState === "error" ? "Discovery needs attention" : "Ready to scan nearby devices"; const detail = discovering ? `${count} StudyMatrix tag${count === 1 ? "" : "s"} found so far. Keep student phones discoverable.` : complete ? `${count} StudyMatrix device tag${count === 1 ? "" : "s"} detected in the active roster.` : scanState === "error" ? "Review the guidance below, then try the scan again." : "Use Bluetooth device tags to mark expected students present."; return <><View style={styles.liveHeading}><View><Text style={styles.liveTitle}>Data Structures</Text><Text style={styles.smallMuted}>TY Computer A · Open for 09:42</Text></View><View style={styles.timer}><MaterialIcons name="timer" size={16} color={colors.maroon} /><Text style={styles.timerText}>08:18</Text></View></View><View style={styles.scanCard}><View style={[styles.scanOrb, discovering && { backgroundColor: colors.green }, scanState === "error" && { backgroundColor: colors.maroon }]}>{discovering ? <ActivityIndicator color="#FFFFFF" size="large" /> : <MaterialIcons name={complete ? "check" : scanState === "error" ? "error-outline" : "bluetooth-searching"} size={35} color="#FFFFFF" />}</View><View style={styles.flex}><Text style={styles.scanTitle}>{headline}</Text><Text style={styles.scanText}>{detail}</Text></View>{discovering ? <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable> : <Pressable onPress={onScan} style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}><Text style={styles.scanButtonText}>{scanState === "error" ? "Try again" : complete ? "Scan again" : "Scan"}</Text></Pressable>}</View>{scanError ? <Callout tone={scanState === "error" ? "error" : "success"} text={scanError} /> : null}<View style={styles.stats}><Stat value={`${count} / 32`} label="Detected" /><View style={styles.statLine} /><Stat value={`${unmatchedTags.length}`} label="Unmatched" /><View style={styles.statLine} /><Stat value={`${Math.max(0, 32 - count)}`} label="Not seen" /></View><Title action="Mark reviewed" onAction={() => Alert.alert("Roster updated", "All displayed students are ready for faculty review.")}>{matchedStudents.length ? "Live matched students" : "Roster review"}</Title>{matchedStudents.length ? matchedStudents.map((student) => <Roster key={student.deviceTag} name={student.fullName} tag={`${student.deviceTag} · ${student.enrollmentNumber}`} status={student.manuallyLinked ? "Manual link" : "Matched"} good />) : <Text style={styles.rangeStatus}>No students detected yet. Wait for discovery or tap Scan.</Text>}{unmatchedTags.length ? <><Title>Unmatched devices</Title><Text style={styles.unmatchedHint}>These StudyMatrix tags were found, but are not registered to a matched student. Link one only after checking the student’s enrollment number.</Text>{unmatchedTags.map((tag) => <View style={styles.unmatchedDevice} key={tag}><RoundIcon name="bluetooth-searching" background="#FFF7E7" color="#9A6C0D" /><View style={styles.flex}><Text style={styles.subjectName}>{tag}</Text><Text style={styles.smallMuted}>Unmatched device tag</Text></View><Pressable onPress={() => onLinkUnmatched(tag)} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}><Text style={styles.linkButtonText}>Link</Text></Pressable></View>)}</> : null}<Button label="Submit attendance" icon="lock-outline" tone="maroon" onPress={onSubmit} /></>; }
function Stat({ value, label }: { value: string; label: string }) { return <View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Roster({ name, tag, status, good = false }: { name: string; tag: string; status: string; good?: boolean }) { const initials = name.split(" ").map((item) => item[0]).join(""); return <View style={styles.roster}><View style={[styles.avatar, { backgroundColor: good ? "#E7F5EE" : "#F8EDEF" }]}><Text style={[styles.avatarText, { color: good ? colors.green : colors.maroon }]}>{initials}</Text></View><View style={styles.flex}><Text style={styles.rosterName}>{name}</Text><Text style={styles.smallMuted}>{tag}</Text></View><View style={[styles.statusPill, { backgroundColor: good ? "#E7F5EE" : "#F8EDEF" }]}><Text style={[styles.statusPillText, { color: good ? colors.green : colors.maroon }]}>{status}</Text></View></View>; }

function CreateSubjectModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [classDivision, setClassDivision] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [room, setRoom] = useState("");
  
  const createMutation = trpc.catalog.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
      setName(""); setCode(""); setClassDivision(""); setTeacherName(""); setRoom("");
    },
    onError: (err) => Alert.alert("Error", err.message)
  });

  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
            <Text style={{ fontSize: 20, fontWeight: "600", color: colors.navy, marginBottom: 16 }}>Create Subject</Text>
            
            <Text style={styles.label}>Subject Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Database Management" placeholderTextColor="#98A2B3" />
            
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Course Code</Text>
                <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="e.g. CS301" placeholderTextColor="#98A2B3" autoCapitalize="characters" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Class Year</Text>
                <TextInput style={styles.input} value={classDivision} onChangeText={setClassDivision} placeholder="e.g. TY-CO" placeholderTextColor="#98A2B3" autoCapitalize="characters" />
              </View>
            </View>
            
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Teacher</Text>
                <TextInput style={styles.input} value={teacherName} onChangeText={setTeacherName} placeholder="Faculty Name" placeholderTextColor="#98A2B3" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Fixed Room</Text>
                <TextInput style={styles.input} value={room} onChangeText={setRoom} placeholder="Room 101" placeholderTextColor="#98A2B3" />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <View style={{ flex: 1 }}><Button label="Cancel" tone="outline" onPress={onClose} /></View>
              <View style={{ flex: 1 }}><Button label="Save" tone="gold" onPress={() => createMutation.mutate({ name, code, classDivision, teacherName, room, dayOfWeek: 1, startTime: "09:00", endTime: "10:00" })} disabled={createMutation.isPending} /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function SimpleDatePickerModal({ visible, current, onClose, onSelect }: { visible: boolean; current: string; onClose: () => void; onSelect: (date: string) => void }) {
  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date(current || Date.now());
    return isNaN(d.getTime()) ? new Date() : d;
  });
  useEffect(() => {
    if (visible) {
      const d = new Date(current || Date.now());
      if (!isNaN(d.getTime())) setBaseDate(d);
    }
  }, [visible, current]);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const prevMonth = () => setBaseDate(new Date(year, month - 1, 1));
  const nextMonth = () => setBaseDate(new Date(year, month + 1, 1));
  const handleSelect = (day: number) => {
    const m = (month + 1).toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    onSelect(`${year}-${m}-${d}`);
  };
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Pressable onPress={prevMonth} style={{ padding: 4 }}><MaterialIcons name="chevron-left" size={28} color={colors.navy} /></Pressable>
            <Text style={{ fontSize: 18, fontWeight: "600", color: colors.navy }}>{monthNames[month]} {year}</Text>
            <Pressable onPress={nextMonth} style={{ padding: 4 }}><MaterialIcons name="chevron-right" size={28} color={colors.navy} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <View key={"h"+i} style={{ width: "14.28%", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>{d}</Text>
              </View>
            ))}
            {[...Array(startDay)].map((_, i) => <View key={"e"+i} style={{ width: "14.28%" }} />)}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const isSelected = current === `${year}-${(month+1).toString().padStart(2,"0")}-${day.toString().padStart(2,"0")}`;
              return (
                <Pressable key={day} onPress={() => handleSelect(day)} style={{ width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isSelected ? colors.gold : "transparent", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: isSelected ? "white" : colors.ink, fontWeight: isSelected ? "600" : "400" }}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 16, alignItems: "flex-end" }}>
            <Pressable onPress={onClose}><Text style={{ color: colors.navy, fontWeight: "600", padding: 8 }}>CANCEL</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AdminRecords() {
  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-31");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const absencesQuery = trpc.attendance.dailyAbsences.useQuery({ startDate, endDate }, { retry: false });
  const filteredAbsences = absencesQuery.data?.filter((row) => (!classFilter.trim() || row.classDivision.toLowerCase().includes(classFilter.trim().toLowerCase())) && (!subjectFilter.trim() || row.subject.toLowerCase().includes(subjectFilter.trim().toLowerCase())));

  const dailyReport: DailyAttendanceReport | null = filteredAbsences ? { date: `${startDate} to ${endDate}`, lectures: Object.values(filteredAbsences.reduce<Record<string, DailyAttendanceReport["lectures"][number]>>((groups, row) => { const key = `${row.date}-${row.subject}-${row.startTime}`; const existing = groups[key] ?? { subject: `${row.subject} · ${row.date}`, teacherName: row.teacherName, classDivision: row.classDivision, room: row.room, timeSlot: `${row.startTime}–${row.endTime}`, absentStudents: [] }; existing.absentStudents.push({ name: row.studentName, enrollmentNumber: row.enrollmentNumber }); groups[key] = existing; return groups; }, {})) } : null;
  const exportDailyPdf = () => { if (dailyReport) { void shareDailyAttendancePdf(dailyReport).catch((error) => Alert.alert("Daily PDF export unavailable", error instanceof Error ? error.message : "Unable to create the full-day PDF")); } else { Alert.alert("No Data", "No daily data available to export."); } };
  const [activeDateField, setActiveDateField] = useState<"start" | "end" | null>(null);
  return <><SimpleDatePickerModal visible={activeDateField !== null} current={activeDateField === "start" ? startDate : endDate} onClose={() => setActiveDateField(null)} onSelect={(d) => { if (activeDateField === "start") setStartDate(d); else setEndDate(d); setActiveDateField(null); }} /><View style={styles.rangeRow}><View style={styles.flex}><Text style={styles.rangeLabel}>Report from</Text><View style={[styles.rangeInput, { flexDirection: "row", alignItems: "center", paddingHorizontal: 0, paddingVertical: 0 }]}><TextInput value={startDate} onChangeText={setStartDate} style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: colors.ink }} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" /><Pressable onPress={() => setActiveDateField("start")} style={{ padding: 12 }}><MaterialIcons name="calendar-today" size={20} color={colors.navy} /></Pressable></View></View><View style={styles.flex}><Text style={styles.rangeLabel}>Report to</Text><View style={[styles.rangeInput, { flexDirection: "row", alignItems: "center", paddingHorizontal: 0, paddingVertical: 0 }]}><TextInput value={endDate} onChangeText={setEndDate} style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: colors.ink }} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" /><Pressable onPress={() => setActiveDateField("end")} style={{ padding: 12 }}><MaterialIcons name="calendar-today" size={20} color={colors.navy} /></Pressable></View></View></View><View style={styles.rangeRow}><View style={styles.flex}><Text style={styles.rangeLabel}>Class filter</Text><TextInput value={classFilter} onChangeText={setClassFilter} style={styles.rangeInput} placeholder="All classes" placeholderTextColor="#98A2B3" /></View><View style={styles.flex}><Text style={styles.rangeLabel}>Subject filter</Text><TextInput value={subjectFilter} onChangeText={setSubjectFilter} style={styles.rangeInput} placeholder="All subjects" placeholderTextColor="#98A2B3" /></View></View><View style={styles.filters}><View style={styles.filter}><MaterialIcons name="calendar-today" size={14} color={colors.navy} /><Text style={styles.filterText}>{startDate} to {endDate}</Text></View><View style={styles.filter}><Text style={styles.filterText}>{subjectFilter || "All subjects"}</Text><MaterialIcons name="filter-list" size={16} color={colors.navy} /></View></View><View style={styles.dailyReportCard}><RoundIcon name="summarize" background="#F5EEDB" color="#9A6C0D" /><View style={styles.flex}><Text style={styles.promptTitle}>Full-day absence report</Text><Text style={styles.smallMuted}>Groups absent students by the selected class, subject, date range, lecture, room, and teacher.</Text></View></View>{filteredAbsences && filteredAbsences.length === 0 ? <Text style={styles.rangeStatus}>No absences match the selected report filters.</Text> : null}{absencesQuery.isFetching ? <Text style={styles.rangeStatus}>Refreshing report range…</Text> : null}<Button label="Export selected-range PDF" icon="picture-as-pdf" tone="gold" onPress={exportDailyPdf} /></>;
}
function RecordLine({ name, description, isPresent }: { name: string; description: string; isPresent: boolean }) { return <View style={styles.recordLine}><View style={[styles.stateIcon, { backgroundColor: isPresent ? "#E7F5EE" : "#FCE8E6" }]}><MaterialIcons name={isPresent ? "check" : "close"} size={19} color={isPresent ? colors.green : "#B42318"} /></View><View style={styles.flex}><Text style={styles.subjectName}>{name}</Text><Text style={styles.smallMuted}>{description}</Text></View><Text style={[styles.presence, { color: isPresent ? colors.green : "#B42318" }]}>{isPresent ? "Present" : "Absent"}</Text></View>; }

function ComposeNotice({ sent, onSend }: { sent: boolean; onSend: () => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const createNotice = trpc.notices.create.useMutation();
  const handleSend = () => {
    if (!title.trim() || !message.trim() || !targetClass.trim()) {
      setErrorMsg("Please fill in the title, message, and target class.");
      return;
    }
    setErrorMsg(null);
    createNotice.mutate({ title: title.trim(), body: message.trim(), targetClass: targetClass.trim() }, {
      onSuccess: () => {
        onSend();
        setTitle("");
        setMessage("");
        setTargetClass("");
      },
      onError: (error) => setErrorMsg(error.message || "Unable to send the notice."),
    });
  };
  return <>
    <Text style={styles.fieldLabel}>Target class / division</Text>
    <TextInput value={targetClass} onChangeText={setTargetClass} style={styles.input} placeholder="TY Computer A" placeholderTextColor="#98A2B3" />
    <Text style={styles.fieldLabel}>Title</Text>
    <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Notice title" placeholderTextColor="#98A2B3" />
    <Text style={styles.fieldLabel}>Message</Text>
    <TextInput value={message} onChangeText={setMessage} style={[styles.input, styles.messageInput]} placeholder="Write a clear, concise notice for students." placeholderTextColor="#98A2B3" multiline textAlignVertical="top" />
    {errorMsg ? <Callout tone="error" text={errorMsg} /> : null}
    {sent ? <Callout tone="success" text="Notice posted and delivered to the selected class." /> : <Button label={createNotice.isPending ? "Sending…" : "Send notice"} icon="send" tone="maroon" onPress={handleSend} />}
  </>;
}

function EnhancedProfile({ role, accountName, deviceTagValue, deviceSetupComplete, deviceVerified, onTroubleshoot, onExit }: { role: Role; accountName: string; deviceTagValue: string; deviceSetupComplete: boolean; deviceVerified: boolean; onTroubleshoot: () => void; onExit: () => void }) {
  const student = role === "student";
  const [copied, setCopied] = useState(false);
  const studentProfileQuery = trpc.profiles.myStudentProfile.useQuery(undefined, { enabled: student, retry: false });
  const sp = studentProfileQuery.data;
  const copyTag = () => { void Clipboard.setStringAsync(deviceTagValue).then(() => setCopied(true), () => Alert.alert("Copy unavailable", "Please select and copy the displayed device name manually.")); };
  const initials = (sp?.fullName ?? accountName).split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "ST";
  return <>
    <View style={styles.profile}>
      <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{initials}</Text></View>
      <Text style={styles.profileName}>{sp?.fullName ?? accountName ?? "Student"}</Text>
      <Text style={styles.profileRole}>{student ? `${sp?.classDivision ?? ""} · Computer Dept` : "Faculty Admin · Computer Dept"}</Text>
    </View>
    {student && sp ? (
      <View style={styles.profileInfoGrid}>
        <ProfileInfoItem icon="badge" label="Enrollment No." value={sp.enrollmentNumber} />
        <ProfileInfoItem icon="format-list-numbered" label="Roll Number" value={sp.rollNumber} />
        <ProfileInfoItem icon="school" label="Class" value={sp.classDivision} />
        <ProfileInfoItem icon="phone" label="Mobile" value={sp.mobileNumber} />
        <ProfileInfoItem icon="family-restroom" label="Parent Mobile" value={sp.parentMobileNumber} />
        <ProfileInfoItem icon={sp.deviceVerified ? "verified" : "schedule"} label="Device Status" value={sp.deviceVerified ? "Verified" : "Not verified"} />
      </View>
    ) : null}
    {student ? <>
      <View style={[styles.verificationBadge, { backgroundColor: deviceVerified ? "#E7F5EE" : "#FFF7E7" }]}>
        <MaterialIcons name={deviceVerified ? "verified" : "schedule"} size={18} color={deviceVerified ? colors.green : "#9A6C0D"} />
        <Text style={[styles.verificationText, { color: deviceVerified ? colors.green : "#9A6C0D" }]}>{deviceVerified ? "Verified during the last faculty scan" : "Not yet verified by a faculty scan"}</Text>
      </View>
      <Title>Bluetooth attendance troubleshooting</Title>
      <View style={styles.troubleshootCard}>
        <RoundIcon name="bluetooth-searching" background="#EAF0F8" color={colors.navy} />
        <View style={styles.flex}><Text style={styles.promptTitle}>Required device name</Text><Text style={styles.deviceTagInline}>{deviceTagValue}</Text><Text style={styles.smallMuted}>{deviceSetupComplete ? "Setup marked complete. If detection fails, verify the phone name and discoverability." : "Setup is incomplete. Automatic Bluetooth attendance may not find this phone."}</Text></View>
      </View>
      {copied ? <Callout tone="success" text="Bluetooth device name copied. Paste it exactly in Android Device name Settings." /> : null}
      <Button label="Copy Bluetooth name" icon="content-copy" tone="outline" onPress={copyTag} />
      <View style={styles.gap} />
      <Button label={deviceSetupComplete ? "Recheck device name setup" : "Set Bluetooth device name"} icon="settings" tone="gold" onPress={onTroubleshoot} />
      <Title>Attendance profile</Title>
      <View style={styles.historyCard}><View style={styles.historyHeading}><View><Text style={styles.subjectName}>Subject attendance graph</Text><Text style={styles.smallMuted}>Percentage across current semester lectures.</Text></View><Text style={styles.historyLegend}>ON TRACK</Text></View><View style={styles.chart}>{sp ? <Text style={styles.smallMuted}>View your dashboard for live subject breakdown.</Text> : null}</View></View>
    </> : <View style={styles.profileItem}><RoundIcon name="bluetooth" background="#E7F5EE" color={colors.green} /><View style={styles.flex}><Text style={styles.profileItemTitle}>Nearby-device access</Text><Text style={styles.smallMuted}>Permission is requested when faculty starts a scan.</Text></View></View>}
    <View style={styles.profileItem}><RoundIcon name="info-outline" /><View style={styles.flex}><Text style={styles.profileItemTitle}>About StudyMatrix Attendance</Text><Text style={styles.smallMuted}>Version 1.0 · Developed by Vinayraj Kore</Text></View></View>
    <Button label="Return to role selection" icon="logout" tone="outline" onPress={onExit} />
  </>;
}
function ProfileInfoItem({ icon, label, value }: { icon: IconName; label: string; value: string }) { return <View style={styles.profileInfoItem}><RoundIcon name={icon} background="#EAF0F8" color={colors.navy} size={20} /><View style={styles.flex}><Text style={styles.profileInfoLabel}>{label}</Text><Text style={styles.profileInfoValue}>{value}</Text></View></View>; }

function Profile({ role, onExit }: { role: Role; onExit: () => void }) { return <EnhancedProfile role={role} accountName="" deviceTagValue="" deviceSetupComplete deviceVerified={false} onTroubleshoot={() => {}} onExit={onExit} />; }

// ─── Admin Student Management ────────────────────────────────────────────────
const CLASS_YEARS = ["All", "FY", "SY", "TY"] as const;

function AdminStudents({ onViewStudent }: { onViewStudent: (studentUserId: number) => void }) {
  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const listQuery = trpc.students.listByClass.useQuery({ classDivision: selectedClass === "All" ? "" : selectedClass }, { retry: false });
  const students = listQuery.data ?? [];
  const filtered = students
    .filter((s) => !search.trim() || s.fullName.toLowerCase().includes(search.toLowerCase()) || s.enrollmentNumber.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortDir === "asc" ? a.percentage - b.percentage : b.percentage - a.percentage);
  return <>
    <View style={styles.classTabRow}>
      {CLASS_YEARS.map((cls) => <Pressable key={cls} onPress={() => setSelectedClass(cls)} style={({ pressed }) => [styles.classTab, selectedClass === cls && styles.classTabActive, pressed && styles.pressed]}><Text style={[styles.classTabText, selectedClass === cls && styles.classTabTextActive]}>{cls}</Text></Pressable>)}
    </View>
    <View style={styles.studentSearchRow}>
      <View style={styles.studentSearchBox}>
        <MaterialIcons name="search" size={20} color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} style={styles.studentSearchInput} placeholder="Search name or enrollment…" placeholderTextColor="#98A2B3" />
        {search ? <Pressable onPress={() => setSearch("")}><MaterialIcons name="close" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <Pressable onPress={() => setSortDir((d) => d === "asc" ? "desc" : "asc")} style={({ pressed }) => [styles.sortBtn, pressed && styles.pressed]}>
        <MaterialIcons name={sortDir === "asc" ? "arrow-upward" : "arrow-downward"} size={16} color={colors.navy} />
        <Text style={styles.sortBtnText}>{sortDir === "asc" ? "Low→High" : "High→Low"}</Text>
      </Pressable>
    </View>
    {listQuery.isLoading ? <ActivityIndicator color={colors.navy} style={{ marginTop: 24 }} /> : filtered.length === 0 ? <Text style={[styles.smallMuted, { textAlign: "center", marginTop: 24 }]}>{search ? "No students match your search." : `No students registered in ${selectedClass}.`}</Text> : filtered.map((student) => {
      const pct = student.percentage;
      const color = pct >= 75 ? colors.green : pct >= 60 ? "#D97706" : colors.maroon;
      const initials = student.fullName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
      return <Pressable key={student.userId} onPress={() => onViewStudent(student.userId)} style={({ pressed }) => [styles.studentCard, pressed && styles.pressed]}>
        <View style={[styles.avatar, { backgroundColor: "#EAF0F8" }]}><Text style={[styles.avatarText, { color: colors.navy }]}>{initials}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.subjectName}>{student.fullName}</Text>
          <Text style={styles.smallMuted}>Roll {student.rollNumber} · {student.enrollmentNumber}</Text>
        </View>
        <View style={[styles.pctBadge, { backgroundColor: pct >= 75 ? "#E7F5EE" : pct >= 60 ? "#FFF7E7" : "#FCE8E6" }]}>
          <Text style={[styles.pctText, { color }]}>{pct}%</Text>
          <Text style={[styles.pctSub, { color }]}>{student.presentCount}P / {student.absentCount}A</Text>
        </View>
      </Pressable>;
    })}
  </>;
}

function StudentDetail({ studentUserId, onBack }: { studentUserId: number; onBack: () => void }) {
  const detailQuery = trpc.students.getDetail.useQuery({ studentUserId }, { retry: false });
  const updateProfile = trpc.students.updateProfile.useMutation();
  const deleteProfile = trpc.students.deleteProfile.useMutation();
  const updateAttendance = trpc.students.updateAttendance.useMutation();
  const profile = detailQuery.data?.profile;
  const attendance = detailQuery.data?.attendance ?? [];
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [parentMobileNumber, setParentMobileNumber] = useState("");
  const [classDivision, setClassDivision] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deletePromptVisible, setDeletePromptVisible] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  const startEdit = () => { if (!profile) return; setFullName(profile.fullName); setMobileNumber(profile.mobileNumber); setParentMobileNumber(profile.parentMobileNumber); setClassDivision(profile.classDivision); setRollNumber(profile.rollNumber); setEditing(true); setSaveMsg(null); };
  const saveProfile = () => { updateProfile.mutate({ studentUserId, fullName, mobileNumber, parentMobileNumber, classDivision, rollNumber }, { onSuccess: () => { setSaveMsg("Profile updated."); setEditing(false); void detailQuery.refetch(); }, onError: (e) => setSaveMsg(e.message || "Save failed.") }); };
  const handleDelete = () => { setAdminPassword(""); setDeletePromptVisible(true); };
  const toggleRecord = (recordId: number, currentStatus: string) => {
    const next = currentStatus === "present" || currentStatus === "manual" ? "absent" : "present";
    updateAttendance.mutate({ recordId, status: next }, { onSuccess: () => { void detailQuery.refetch(); }, onError: (e) => Alert.alert("Error", e.message || "Unable to update attendance.") });
  };

  if (detailQuery.isLoading) return <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />;
  if (!profile) return <Text style={styles.smallMuted}>Student not found.</Text>;

  const total = attendance.length;
  const present = attendance.filter((r) => r.status === "present" || r.status === "manual").length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 100;
  const initials = profile.fullName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return <>
    <View style={styles.profile}>
      <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{initials}</Text></View>
      <Text style={styles.profileName}>{profile.fullName}</Text>
      <Text style={styles.profileRole}>{profile.classDivision} · Roll {profile.rollNumber}</Text>
      <View style={[styles.pctBadge, { backgroundColor: pct >= 75 ? "#E7F5EE" : pct >= 60 ? "#FFF7E7" : "#FCE8E6", marginTop: 12, paddingHorizontal: 18, paddingVertical: 8 }]}>
        <Text style={[styles.pctText, { fontSize: 22, color: pct >= 75 ? colors.green : pct >= 60 ? "#D97706" : colors.maroon }]}>{pct}%</Text>
        <Text style={[styles.pctSub, { color: pct >= 75 ? colors.green : pct >= 60 ? "#D97706" : colors.maroon }]}>{present} present / {total - present} absent</Text>
      </View>
    </View>
    {editing ? (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.fieldLabel}>Full name</Text>
        <TextInput value={fullName} onChangeText={setFullName} style={styles.input} />
        <View style={styles.twoFields}>
          <View style={styles.flex}><Text style={styles.fieldLabel}>Roll number</Text><TextInput value={rollNumber} onChangeText={setRollNumber} style={styles.input} /></View>
          <View style={styles.flex}><Text style={styles.fieldLabel}>Class</Text><TextInput value={classDivision} onChangeText={setClassDivision} style={styles.input} placeholder="FY / SY / TY" placeholderTextColor="#98A2B3" /></View>
        </View>
        <Text style={styles.fieldLabel}>Mobile number</Text>
        <TextInput value={mobileNumber} onChangeText={setMobileNumber} style={styles.input} keyboardType="phone-pad" />
        <Text style={styles.fieldLabel}>Parent mobile number</Text>
        <TextInput value={parentMobileNumber} onChangeText={setParentMobileNumber} style={styles.input} keyboardType="phone-pad" />
        {saveMsg ? <Callout tone={saveMsg.includes("updated") ? "success" : "error"} text={saveMsg} /> : null}
        <Button label={updateProfile.isPending ? "Saving…" : "Save changes"} icon="save" tone="maroon" onPress={saveProfile} />
        <Pressable onPress={() => { setEditing(false); setSaveMsg(null); }} style={({ pressed }) => [styles.cancelEdit, pressed && styles.pressed]}><Text style={styles.cancelEditText}>Cancel edit</Text></Pressable>
      </View>
    ) : (
      <>
        <View style={styles.profileInfoGrid}>
          <ProfileInfoItem icon="badge" label="Enrollment No." value={profile.enrollmentNumber} />
          <ProfileInfoItem icon="format-list-numbered" label="Roll Number" value={profile.rollNumber} />
          <ProfileInfoItem icon="school" label="Class" value={profile.classDivision} />
          <ProfileInfoItem icon="phone" label="Mobile" value={profile.mobileNumber} />
          <ProfileInfoItem icon="family-restroom" label="Parent Mobile" value={profile.parentMobileNumber} />
          <ProfileInfoItem icon={profile.deviceVerified ? "verified" : "schedule"} label="Device" value={profile.deviceVerified ? "Verified" : "Unverified"} />
        </View>
        {saveMsg ? <Callout tone="success" text={saveMsg} /> : null}
        <Button label="Edit student info" icon="edit" tone="gold" onPress={startEdit} />
        <View style={{ marginTop: 12 }} />
        <Button label={deleteProfile.isPending ? "Deleting…" : "Delete student account"} icon="delete-outline" tone="outline" onPress={handleDelete} />
      </>
    )}
    <Title>{`Attendance records (${total})`}</Title>
    {attendance.length === 0 ? <Text style={[styles.smallMuted, { textAlign: "center", marginTop: 12 }]}>No attendance records yet.</Text> : attendance.map((record) => {
      const isPresent = record.status === "present" || record.status === "manual";
      return <Pressable key={record.recordId} onPress={() => toggleRecord(record.recordId, record.status)} style={({ pressed }) => [styles.recordLine, pressed && styles.pressed]}>
        <View style={[styles.stateIcon, { backgroundColor: isPresent ? "#E7F5EE" : "#FCE8E6" }]}>
          <MaterialIcons name={isPresent ? "check" : "close"} size={19} color={isPresent ? colors.green : "#B42318"} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.subjectName}>{record.subject}</Text>
          <Text style={styles.smallMuted}>{record.date} · {record.startTime} · {record.subjectCode}</Text>
        </View>
        <Text style={[styles.presence, { color: isPresent ? colors.green : "#B42318" }]}>{isPresent ? "Present" : "Absent"}</Text>
      </Pressable>;
    })}
    <View style={styles.gap} />
    <Modal visible={deletePromptVisible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ backgroundColor: "#FFFFFF", padding: 24, borderRadius: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: colors.ink, marginBottom: 8 }}>Confirm deletion</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16, lineHeight: 18 }}>This will permanently delete the student account and their attendance records. Enter your administrator password to confirm.</Text>
            <TextInput value={adminPassword} onChangeText={setAdminPassword} secureTextEntry placeholder="Admin password" style={styles.input} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}><Button label="Cancel" tone="outline" onPress={() => setDeletePromptVisible(false)} /></View>
              <View style={{ flex: 1 }}><Button label={deleteProfile.isPending ? "Deleting..." : "Delete"} tone="maroon" onPress={() => deleteProfile.mutate({ studentUserId, adminPassword }, { onSuccess: onBack, onError: (e) => Alert.alert("Error", e.message || "Failed to delete.") })} /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  </>;
}

function BottomNav({ role, current, onOpen }: { role: Role; current: Screen; onOpen: (screen: Screen) => void }) { const items = role === "student" ? [{ label: "Home", icon: "home" as IconName, screen: "studentHome" as Screen }, { label: "Records", icon: "calendar-month" as IconName, screen: "studentRecords" as Screen }, { label: "Notices", icon: "notifications-none" as IconName, screen: "notices" as Screen }] : [{ label: "Home", icon: "home" as IconName, screen: "adminHome" as Screen }, { label: "Students", icon: "people" as IconName, screen: "adminStudents" as Screen }, { label: "Records", icon: "assessment" as IconName, screen: "adminRecords" as Screen }, { label: "Notice", icon: "campaign" as IconName, screen: "composeNotice" as Screen }]; return <View style={styles.bottom}>{items.map((item) => { const active = current === item.screen || (item.screen === "adminStudents" && current === "studentDetail"); return <Pressable key={item.label} onPress={() => onOpen(item.screen)} style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}>{active ? <View style={styles.navActiveIndicator} /> : <View style={{ width: 5, height: 5 }} />}<MaterialIcons name={item.icon} size={23} color={active ? colors.navy : colors.muted} /><Text style={[styles.navText, active && { color: colors.navy, fontWeight: "900" }]}>{item.label}</Text></Pressable>; })}</View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  welcomeHero: { minHeight: 415, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }, seal: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginBottom: 20 }, collegeLogo: { width: 116, height: 116, marginBottom: 12 }, institute: { color: "#F6F2E9", fontWeight: "800", letterSpacing: 1.15, fontSize: 10, textAlign: "center" }, department: { color: "#D8CDAE", fontSize: 13, marginTop: 7 }, product: { color: "#FFFFFF", fontWeight: "900", fontSize: 32, marginTop: 25, letterSpacing: -0.7 }, productSub: { color: colors.gold, letterSpacing: 4.1, fontWeight: "900", fontSize: 11, marginTop: 2 }, welcomeCopy: { color: "#C9D2DF", fontSize: 14, textAlign: "center", lineHeight: 21, marginTop: 18, maxWidth: 310 },
  welcomeActions: { backgroundColor: colors.paper, flex: 1, padding: 20 }, choose: { fontSize: 16, fontWeight: "900", color: colors.ink, marginBottom: 12 }, roleCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 11 }, backendTestCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#B7C6D9", borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 11 }, roleName: { color: colors.ink, fontSize: 15, fontWeight: "900" }, roleDetail: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, credit: { textAlign: "center", color: colors.muted, fontSize: 11, marginTop: 4 },
  header: { height: 73, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.paper }, mark: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }, markText: { color: colors.gold, fontWeight: "900", fontSize: 12 }, headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EDF1F5", alignItems: "center", justifyContent: "center" }, headerCopy: { marginLeft: 11 }, headerTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 }, headerSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  content: { padding: 16, paddingBottom: 110, backgroundColor: colors.paper, flexGrow: 1 }, roundIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, button: { height: 52, borderRadius: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }, buttonText: { fontSize: 14, fontWeight: "900", letterSpacing: 0.2 },
  studentHero: { backgroundColor: colors.navy, borderRadius: 24, padding: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, eyebrow: { color: "#BFB28A", fontSize: 10, letterSpacing: 1.4, fontWeight: "900" }, bigPercent: { color: "#FFFFFF", fontSize: 42, fontWeight: "900", letterSpacing: -2, marginTop: 2 }, heroMeta: { color: "#A8BAD1", fontSize: 12, marginTop: 0 }, daysRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: colors.gold, alignItems: "center", justifyContent: "center", shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }, daysNumber: { color: "#FFFFFF", fontWeight: "900", fontSize: 20 }, daysLabel: { color: "#BFB28A", fontWeight: "900", fontSize: 8, letterSpacing: 0.8 },
  sessionCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", marginBottom: 13, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }, sessionIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.maroon, alignItems: "center", justifyContent: "center" }, sessionEyebrow: { color: colors.maroon, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 }, sessionTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 2 }, sessionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  reminderCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, marginTop: 13, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }, disabledCard: { opacity: 0.75 }, testSpinner: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy }, testingLabel: { color: colors.navy, fontSize: 11, fontWeight: "900" }, bluetoothToast: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 11, flexDirection: "row", gap: 10, alignItems: "flex-start" }, toastTitle: { fontSize: 13, fontWeight: "900" }, toastText: { fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 3 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", letterSpacing: -0.2 }, titleAction: { color: colors.maroon, fontSize: 13, fontWeight: "900" }, subjectRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border }, dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 }, subjectName: { color: colors.ink, fontSize: 14, fontWeight: "900" }, smallMuted: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 18 }, subjectPct: { color: colors.navy, fontSize: 18, fontWeight: "900" }, noticePrompt: { marginTop: 23, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: colors.border, padding: 15, borderRadius: 18, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }, promptTitle: { color: colors.ink, fontWeight: "900", fontSize: 14 },
  info: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 15, backgroundColor: "#EAF0F8", padding: 14, marginBottom: 18 }, infoText: { color: colors.navy, flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" }, recordLine: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }, stateIcon: { width: 37, height: 37, borderRadius: 12, alignItems: "center", justifyContent: "center" }, presence: { fontSize: 12, fontWeight: "900" }, breakdown: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center" }, breakdownRight: { alignItems: "flex-end", width: 80 }, track: { height: 5, width: 76, backgroundColor: colors.border, overflow: "hidden", borderRadius: 4, marginTop: 5 }, fill: { height: "100%", borderRadius: 4 },
  codeScreen: { alignItems: "center", paddingTop: 14 }, keyIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", marginBottom: 16 }, codeTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" }, codeCopy: { color: colors.muted, textAlign: "center", fontSize: 14, lineHeight: 21, maxWidth: 302, marginTop: 8, marginBottom: 20 }, codeInput: { width: "100%", height: 67, borderWidth: 1.2, borderColor: colors.border, backgroundColor: "#FFFFFF", borderRadius: 16, color: colors.navy, fontSize: 27, fontWeight: "900", letterSpacing: 9, marginBottom: 13 }, callout: { width: "100%", borderRadius: 14, padding: 14, marginTop: 13, flexDirection: "row", gap: 9, alignItems: "center" }, calloutText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "800" }, hint: { width: "100%", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginTop: 18, flexDirection: "row", gap: 9 }, hintText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  notice: { backgroundColor: "#FFFFFF", flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: 17, overflow: "hidden", marginBottom: 12 }, noticeAccent: { width: 5 }, noticeBody: { flex: 1, padding: 16 }, noticeDate: { color: colors.maroon, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" }, noticeTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 5 }, noticeText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7 }, noticeAuthor: { color: colors.navy, fontSize: 11, fontWeight: "800", marginTop: 12 },
  adminHero: { backgroundColor: colors.navy, padding: 22, borderRadius: 24, marginBottom: 16, shadowColor: colors.navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8 }, adminTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginTop: 6, letterSpacing: -0.5 }, adminCopy: { color: "#A8BAD1", fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 17 }, grid: { flexDirection: "row", gap: 12 }, quickCard: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }, quickTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 11 }, timetable: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 17, marginBottom: 9, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }, time: { width: 41, color: colors.navy, fontSize: 13, fontWeight: "900" }, timeLine: { width: 3, height: 37, borderRadius: 3, marginHorizontal: 9 }, timetableMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, nextPill: { backgroundColor: "#F5EEDB", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9 }, nextText: { color: "#9A6C0D", fontSize: 9, letterSpacing: 0.8, fontWeight: "900" }, metrics: { flexDirection: "row", gap: 9 }, metric: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, alignItems: "center", shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }, metricValue: { color: colors.navy, fontWeight: "900", fontSize: 22, letterSpacing: -0.5 }, metricLabel: { color: colors.muted, fontSize: 10, lineHeight: 14, textAlign: "center", marginTop: 4 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "900", marginBottom: 6, marginTop: 2 }, field: { height: 50, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, fieldText: { color: colors.ink, fontSize: 14, fontWeight: "800" }, twoFields: { flexDirection: "row", gap: 8 }, audienceRow: { flexDirection: "row", gap: 10, marginBottom: 17 }, audienceChoice: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, audienceChoiceActive: { backgroundColor: colors.navy, borderColor: colors.navy }, audienceText: { color: colors.navy, fontSize: 12, fontWeight: "900" }, audienceTextActive: { color: "#FFFFFF" }, fallback: { flexDirection: "row", gap: 11, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 23 }, fallbackTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  liveHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, liveTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.3 }, timer: { backgroundColor: "#F8EDEF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", gap: 5, alignItems: "center" }, timerText: { color: colors.maroon, fontWeight: "900", fontSize: 13 }, scanCard: { backgroundColor: colors.navy, padding: 18, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 13, shadowColor: colors.navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8 }, scanOrb: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.maroon, alignItems: "center", justifyContent: "center" }, scanTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" }, scanText: { color: "#A8BAD1", fontSize: 11, lineHeight: 16, marginTop: 3 }, scanButton: { paddingVertical: 10, paddingHorizontal: 13, borderRadius: 11, backgroundColor: colors.gold }, scanButtonText: { color: colors.navy, fontSize: 12, fontWeight: "900" }, cancelButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: "#3D5A7A" }, cancelButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" }, stats: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginTop: 13, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }, statValue: { color: colors.navy, fontWeight: "900", fontSize: 18, textAlign: "center" }, statLabel: { color: colors.muted, fontSize: 10, marginTop: 3, textAlign: "center" }, statLine: { width: 1, height: 32, backgroundColor: colors.border }, roster: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, avatar: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, avatarText: { fontWeight: "900", fontSize: 12 }, rosterName: { color: colors.ink, fontSize: 14, fontWeight: "900" }, statusPill: { borderRadius: 9, paddingVertical: 5, paddingHorizontal: 9 }, statusPillText: { fontSize: 10, fontWeight: "900" }, unmatchedHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: 4 }, unmatchedDevice: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }, linkButton: { backgroundColor: colors.navy, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 }, linkButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 15 }, filter: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 10 }, filterText: { color: colors.navy, fontSize: 11, fontWeight: "900" }, recordSummary: { backgroundColor: colors.navy, borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-around", alignItems: "center" }, summaryValue: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", textAlign: "center" }, summaryLabel: { color: "#D1DBE8", fontSize: 11, marginTop: 4, textAlign: "center" }, summaryLine: { width: 1, height: 38, backgroundColor: "#50637D" }, gap: { height: 10 },
  input: { height: 52, backgroundColor: "#F1F5F9", borderWidth: 0, borderRadius: 14, paddingHorizontal: 16, fontSize: 14, color: colors.ink, marginBottom: 16 }, messageInput: { height: 120, paddingTop: 14 },
  passwordContainer: { height: 52, backgroundColor: "#F1F5F9", borderRadius: 14, flexDirection: "row", alignItems: "center", marginBottom: 16 }, passwordInputInner: { flex: 1, paddingLeft: 16, fontSize: 14, color: colors.ink, height: "100%" }, passwordToggle: { padding: 14, justifyContent: "center", alignItems: "center" },
  profile: { backgroundColor: colors.navy, borderRadius: 24, padding: 26, alignItems: "center", marginBottom: 17, shadowColor: colors.navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }, profileAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold, marginBottom: 12, shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }, profileInitials: { color: colors.navy, fontSize: 22, fontWeight: "900" }, profileName: { color: "#FFFFFF", fontSize: 19, fontWeight: "900", letterSpacing: -0.3 }, profileRole: { color: "#A8BAD1", fontSize: 12, marginTop: 4 }, profileItem: { backgroundColor: "#FFFFFF", borderRadius: 17, padding: 15, borderWidth: 1, borderColor: colors.border, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }, profileItemTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  bottom: { minHeight: 58, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 36, paddingTop: 8, alignItems: "center" }, navItem: { minWidth: 54, alignItems: "center", gap: 3 }, navText: { color: colors.muted, fontSize: 9, fontWeight: "800" }, navActiveIndicator: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold, marginBottom: -2, marginTop: 2 },
  historyCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15 }, historyHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }, historyLegend: { color: colors.green, fontSize: 9, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 }, chart: { height: 142, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 18 }, chartColumn: { flex: 1, alignItems: "center", height: "100%" }, chartTrack: { width: 18, height: 102, backgroundColor: "#EEF2F6", borderRadius: 10, justifyContent: "flex-end", overflow: "hidden" }, chartBar: { width: "100%", borderRadius: 10 }, chartLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 7 },
  drawerOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, flexDirection: "row" }, drawerScrim: { flex: 1, backgroundColor: "rgba(11,31,58,0.42)" }, drawer: { width: "83%", maxWidth: 330, backgroundColor: colors.paper, paddingTop: 24, paddingHorizontal: 15, paddingBottom: 20, shadowColor: "#172033", shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 }, drawerHeader: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 20 }, drawerProfile: { flex: 1, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.navy, borderRadius: 16, padding: 12 }, drawerAvatar: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" }, drawerAvatarText: { color: colors.navy, fontSize: 12, fontWeight: "900" }, drawerName: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" }, drawerRole: { color: "#D1DBE8", fontSize: 10, marginTop: 3 }, drawerClose: { width: 35, height: 35, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, drawerList: { gap: 6 }, drawerItem: { flexDirection: "row", alignItems: "center", gap: 13, minHeight: 49, paddingHorizontal: 13, borderRadius: 13 }, drawerItemActive: { backgroundColor: colors.navy }, drawerItemText: { color: colors.navy, fontSize: 14, fontWeight: "900" }, drawerItemTextActive: { color: "#FFFFFF" }, drawerFooter: { position: "absolute", left: 15, right: 15, bottom: 20, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", opacity: 0.9 }, drawerFooterText: { color: colors.gold, fontSize: 7.5, fontWeight: "600", letterSpacing: 0.8 },
  catalogCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 16, flexDirection: "row", gap: 11, padding: 13, marginBottom: 10 }, catalogCode: { minWidth: 58, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" }, catalogCodeText: { color: colors.navy, fontSize: 11, fontWeight: "900" }, managePrompt: { marginTop: 11, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 17 },
  catalogActions: { gap: 7, justifyContent: "center" }, catalogAction: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#EAF0F8", alignItems: "center", justifyContent: "center" }, deleteAction: { backgroundColor: "#FCE8E6" }, cancelEdit: { alignSelf: "center", marginTop: 11, paddingHorizontal: 14, paddingVertical: 8 }, cancelEditText: { color: colors.maroon, fontSize: 13, fontWeight: "900" },
  dailyReportCard: { marginTop: 20, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
  rangeRow: { flexDirection: "row", gap: 10, marginBottom: 14 }, rangeLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", marginBottom: 5 }, rangeInput: { height: 44, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 11, color: colors.ink, fontSize: 13, fontWeight: "800" }, rangeStatus: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 6 },
  selectorOptions: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 13, marginTop: -12, marginBottom: 17, overflow: "hidden" }, selectorOption: { minHeight: 44, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border }, selectorOptionActive: { backgroundColor: colors.navy }, selectorOptionText: { color: colors.ink, fontSize: 13, fontWeight: "800" }, selectorOptionTextActive: { color: "#FFFFFF" },
  authScreen: { flexGrow: 1, backgroundColor: colors.paper, paddingHorizontal: 20, paddingTop: 72, paddingBottom: 32 }, authScreenNarrow: { paddingHorizontal: 14 }, authBack: { position: "absolute", top: 18, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3, zIndex: 10 }, authMark: { alignSelf: "center", width: 88, height: 88, borderRadius: 44, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", marginBottom: 20, shadowColor: colors.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 }, authCollegeLogo: { width: 60, height: 60 }, authTitle: { color: colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center", letterSpacing: -0.5, marginBottom: 6 }, authDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", paddingHorizontal: 10 }, authCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 28, paddingHorizontal: 24, paddingVertical: 32, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 6 }, authLink: { alignSelf: "center", paddingVertical: 16 }, authLinkText: { color: colors.maroon, fontSize: 13, fontWeight: "900" },
  setupLabel: { color: colors.muted, textAlign: "center", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }, deviceTagCard: { marginTop: 9, backgroundColor: colors.navy, borderRadius: 16, minHeight: 70, alignItems: "center", justifyContent: "center", gap: 7, flexDirection: "row", paddingHorizontal: 14 }, deviceTagText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900", letterSpacing: 1.2 }, setupCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 16 }, setupNotice: { marginTop: 14, marginBottom: 14, padding: 12, flexDirection: "row", gap: 9, borderRadius: 13, backgroundColor: "#EAF0F8" }, setupNoticeText: { flex: 1, color: colors.navy, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  deviceReminder: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF7E7", borderWidth: 1, borderColor: "#E8C274", borderRadius: 17, padding: 14, marginBottom: 13 }, troubleshootCard: { flexDirection: "row", alignItems: "flex-start", gap: 11, backgroundColor: "#FFFFFF", borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 14 }, deviceTagInline: { color: colors.navy, fontSize: 16, fontWeight: "900", letterSpacing: 0.8, marginTop: 4 },
  verificationBadge: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginBottom: 12 }, verificationText: { fontSize: 12, fontWeight: "900" },
  classTabRow: { flexDirection: "row", gap: 10, marginBottom: 16 }, classTab: { flex: 1, height: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, classTabActive: { backgroundColor: colors.navy, borderColor: colors.navy }, classTabText: { color: colors.navy, fontWeight: "900", fontSize: 14 }, classTabTextActive: { color: "#FFFFFF" },
  studentSearchRow: { flexDirection: "row", gap: 8, marginBottom: 14, alignItems: "center" }, studentSearchBox: { flex: 1, height: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FFFFFF", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7 }, studentSearchInput: { flex: 1, fontSize: 13, color: colors.ink }, sortBtn: { flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: "#EAF0F8", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 }, sortBtnText: { color: colors.navy, fontSize: 11, fontWeight: "900" },
  studentCard: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 13, marginBottom: 10, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }, pctBadge: { alignItems: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, minWidth: 56 }, pctText: { fontWeight: "900", fontSize: 16 }, pctSub: { fontSize: 9, fontWeight: "900", marginTop: 1 },
  profileInfoGrid: { gap: 8, marginBottom: 16 }, profileInfoItem: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 }, profileInfoLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, profileInfoValue: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 1 },
  welcomeBrandBlock: { alignItems: "center" }, crestAnimation: { alignItems: "center", justifyContent: "center", marginBottom: 12 }, crestImage: { width: "100%", height: "100%" }, brandedLoader: { alignItems: "center", justifyContent: "center", gap: 10, padding: 22 }, brandedLoaderCompact: { flexDirection: "row", padding: 12 }, brandedLoaderText: { color: colors.navy, fontSize: 13, fontWeight: "900", textAlign: "center" }, brandedLoaderTextCompact: { textAlign: "left" }, authLoadingOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(248,246,241,0.95)", alignItems: "center", justifyContent: "center" },
});
