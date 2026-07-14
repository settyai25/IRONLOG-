const CONFIG = { supabaseUrl: "", supabaseAnonKey: "" };

const tabs = [
  ["dashboard", "Dashboard"],
  ["scan", "Meal scan"],
  ["diet", "Diet"],
  ["recovery", "Recovery"],
  ["workouts", "Workouts"],
  ["photos", "Photos"],
  ["coach", "Coach"],
  ["settings", "Settings"]
];

const state = {
  tab: "dashboard",
  session: null,
  email: localStorage.getItem("ironlog_email") || "",
  profile: load("profile", null),
  chat: load("chat", []),
  pendingImage: null,
  supabase: null
};

const defaults = {
  sex: "male",
  weight: 70,
  height: 172,
  age: 25,
  diet: "nonveg",
  activity: 1.45,
  goal: "recomp"
};

const foodPool = [
  ["Paneer bhurji", "150g", 390, 28, 12, 27, true],
  ["Greek yogurt bowl", "250g", 230, 24, 22, 4, true],
  ["Dal and rice", "1 plate", 520, 22, 82, 10, true],
  ["Soya chunks curry", "75g dry", 310, 39, 24, 3, true],
  ["Egg omelette", "3 eggs", 270, 21, 2, 19, false],
  ["Chicken breast", "180g", 300, 55, 0, 7, false],
  ["Fish curry", "1 bowl", 340, 36, 8, 18, false],
  ["Whey shake", "1 scoop", 125, 24, 3, 2, true]
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const config = await fetch("/api/config").then(r => r.json());
    Object.assign(CONFIG, config);
  } catch {
    CONFIG.supabaseUrl = "";
    CONFIG.supabaseAnonKey = "";
  }

  if (window.supabase && CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
    state.supabase = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    state.email = data.session?.user?.email || state.email;
    if (state.email) localStorage.setItem("ironlog_email", state.email);
    state.supabase.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      state.email = session?.user?.email || state.email;
      if (state.email) localStorage.setItem("ironlog_email", state.email);
      render();
    });
  }

  document.querySelectorAll("[data-open-auth]").forEach(button => button.addEventListener("click", openAuth));
  document.querySelectorAll("[data-plan]").forEach(button => button.addEventListener("click", () => startPayment(button.dataset.plan)));
  document.getElementById("send-link").addEventListener("click", sendMagicLink);
  document.getElementById("auth-action").addEventListener("click", authAction);
  buildTabs();
  ensureTrial();
  if (!state.profile) {
    state.profile = { ...defaults, ...computeTargets(defaults) };
    save("profile", state.profile);
  }
  render();
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(`ironlog_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(`ironlog_${key}`, JSON.stringify(value));
}

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function day(date = today()) {
  return load(`day_${date}`, { food: [], workouts: [], sleep: null });
}

function saveDay(value, date = today()) {
  save(`day_${date}`, value);
}

function ensureTrial() {
  if (!localStorage.getItem("ironlog_trial_start")) {
    localStorage.setItem("ironlog_trial_start", new Date().toISOString());
  }
}

function access() {
  const paidUntil = localStorage.getItem("ironlog_paid_until");
  if (paidUntil && new Date(paidUntil) > new Date()) return { ok: true, label: `Paid until ${new Date(paidUntil).toLocaleDateString()}` };
  const start = new Date(localStorage.getItem("ironlog_trial_start") || new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const days = Math.ceil((end - new Date()) / 86400000);
  return { ok: days >= 0, days, label: days >= 0 ? `${days} trial days left` : "Trial ended" };
}

function buildTabs() {
  const wrap = document.getElementById("tabs");
  wrap.innerHTML = tabs.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join("");
  wrap.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      location.hash = "app";
      render();
    });
  });
}

function render() {
  document.getElementById("auth-state").textContent = state.email || "Not signed in";
  document.getElementById("auth-action").textContent = state.session ? "Logout" : "Login";
  document.querySelectorAll("#tabs button").forEach(button => button.classList.toggle("active", button.dataset.tab === state.tab));
  renderNotice();

  const gated = !state.email && state.tab !== "settings";
  if (gated) return renderLoginGate();
  if (!access().ok && state.tab !== "settings") return renderPaywall();

  const routes = {
    dashboard: renderDashboard,
    scan: renderScan,
    diet: renderDiet,
    recovery: renderRecovery,
    workouts: renderWorkouts,
    photos: renderPhotos,
    coach: renderCoach,
    settings: renderSettings
  };
  routes[state.tab]();
}

function renderNotice() {
  const a = access();
  document.getElementById("notice").innerHTML = `<div class="notice"><span>${a.label}</span><div><button class="btn small secondary" data-pay-month>₹199/mo</button> <button class="btn small" data-pay-year>₹2000/yr</button></div></div>`;
  document.querySelector("[data-pay-month]").onclick = () => startPayment("monthly");
  document.querySelector("[data-pay-year]").onclick = () => startPayment("yearly");
}

function head(title, sub = "") {
  return `<div class="view-head"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div></div>`;
}

function renderLoginGate() {
  view().innerHTML = `${head("Login required", "Use your mail ID to start the 30-day free trial.")}
    <div class="card"><p class="sub">Click below and check your inbox for the login link.</p><button class="btn" data-open-auth>Login with email</button></div>`;
  view().querySelector("[data-open-auth]").onclick = openAuth;
}

function renderPaywall() {
  view().innerHTML = `${head("Trial complete", "Choose a plan to continue using IRONLOG.")}
    <div class="grid2">
      <div class="card"><h3>Monthly</h3><p class="sub">₹199 every month.</p><button class="btn block" onclick="startPayment('monthly')">Pay ₹199</button></div>
      <div class="card"><h3>Yearly</h3><p class="sub">₹2000 for one year.</p><button class="btn block" onclick="startPayment('yearly')">Pay ₹2000</button></div>
    </div>`;
}

function view() {
  return document.getElementById("view");
}

function computeTargets(p) {
  const bmr = p.sex === "male"
    ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
  let calories = bmr * Number(p.activity || 1.45);
  if (p.goal === "cut") calories -= 350;
  if (p.goal === "bulk") calories += 300;
  const protein = Math.round(p.weight * (p.goal === "bulk" ? 2 : 1.8));
  const fat = Math.round((calories * .25) / 9);
  const carbs = Math.round(Math.max(0, calories - protein * 4 - fat * 9) / 4);
  return { calorieTarget: Math.round(calories), proteinTarget: protein, carbTarget: carbs, fatTarget: fat };
}

function totals(items) {
  return items.reduce((sum, f) => ({
    cal: sum.cal + Number(f.cal || 0),
    protein: sum.protein + Number(f.protein || 0),
    carbs: sum.carbs + Number(f.carbs || 0),
    fat: sum.fat + Number(f.fat || 0)
  }), { cal: 0, protein: 0, carbs: 0, fat: 0 });
}

function renderDashboard() {
  const d = day();
  const t = totals(d.food);
  const rec = recoveryScore();
  view().innerHTML = `${head("Dashboard", `Today - ${new Date().toDateString()}`)}
    <div class="grid4">
      ${metric("Calories", Math.round(t.cal), `of ${state.profile.calorieTarget}`)}
      ${metric("Protein", `${Math.round(t.protein)}g`, `of ${state.profile.proteinTarget}g`)}
      ${metric("Recovery", rec ? `${rec}%` : "-", d.sleep ? "from sleep log" : "log sleep")}
      ${metric("Workouts", d.workouts.length, "today")}
    </div>
    <div class="grid2" style="margin-top:14px">
      <div class="card"><h3>Food log</h3>${entryList(d.food, f => `${f.name}<span class="tiny">${f.cal} kcal - P${f.protein} C${f.carbs} F${f.fat}</span>`) || empty("No meals logged yet.")}<button class="btn block" onclick="go('scan')">Scan a meal</button></div>
      <div class="card"><h3>Today's focus</h3><p class="sub">${Math.max(0, state.profile.proteinTarget - t.protein).toFixed(0)}g protein and ${Math.max(0, state.profile.calorieTarget - t.cal).toFixed(0)} kcal left.</p><div class="bar-wrap">${bars([t.protein / state.profile.proteinTarget, t.cal / state.profile.calorieTarget, d.workouts.length / 2, (rec || 0) / 100])}</div></div>
    </div>`;
}

function metric(label, value, sub) {
  return `<div class="card metric"><span>${label}</span><strong>${value}</strong><span>${sub}</span></div>`;
}

function bars(values) {
  return values.map(v => `<div class="bar" style="height:${Math.max(4, Math.min(100, v * 100))}%"></div>`).join("");
}

function entryList(items, renderer) {
  return items.length ? items.map((item, i) => `<div class="entry"><div>${renderer(item)}</div><button class="link-btn" onclick="removeEntry(${i})">Remove</button></div>`).join("") : "";
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function removeEntry(index) {
  const d = day();
  d.food.splice(index, 1);
  saveDay(d);
  render();
}

function renderScan() {
  view().innerHTML = `${head("Meal scan", "Upload a clear food photo. AI estimates nutrition.")}
    <div class="card">
      <label class="upload" for="food-file">Tap to take or choose a food photo</label>
      <input id="food-file" type="file" accept="image/*" capture="environment" hidden>
      <div id="scan-out"></div>
    </div>`;
  document.getElementById("food-file").onchange = handleFoodFile;
}

function handleFoodFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    state.pendingImage = { dataUrl, base64: dataUrl.split(",")[1], mediaType: file.type || "image/jpeg" };
    document.getElementById("scan-out").innerHTML = `<img class="preview-img" src="${dataUrl}" alt="Selected meal"><button class="btn block" style="margin-top:12px" onclick="analyzeFood()">Analyze photo</button>`;
  };
  reader.readAsDataURL(file);
}

async function analyzeFood() {
  const out = document.getElementById("scan-out");
  if (!state.session) {
    out.insertAdjacentHTML("beforeend", `<p class="sub">Please sign in first to use the AI meal scanner.</p>`);
    return;
  }
  out.insertAdjacentHTML("beforeend", `<p class="sub">Analyzing...</p>`);
  try {
    const res = await fetch("/api/analyze-food", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.session.access_token}` },
      body: JSON.stringify({ imageBase64: state.pendingImage.base64, mediaType: state.pendingImage.mediaType, profile: state.profile })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    window.lastFood = data.result;
    out.innerHTML = `<img class="preview-img" src="${state.pendingImage.dataUrl}" alt="Selected meal">
      <div class="card" style="margin-top:12px"><h3>${data.result.foodName}</h3><p class="sub">${data.result.portion} - ${data.result.confidence} confidence</p>
      <div class="grid4">${metric("Calories", data.result.calories, "kcal")}${metric("Protein", `${data.result.protein_g}g`, "")}${metric("Carbs", `${data.result.carbs_g}g`, "")}${metric("Fat", `${data.result.fat_g}g`, "")}</div>
      <p class="sub">${data.result.notes}</p><button class="btn block" onclick="logFood()">Log this meal</button></div>`;
  } catch (error) {
    out.insertAdjacentHTML("beforeend", `<p class="sub">Could not analyze: ${error.message}</p>`);
  }
}

function logFood() {
  const f = window.lastFood;
  const d = day();
  d.food.push({ name: f.foodName, cal: f.calories, protein: f.protein_g, carbs: f.carbs_g, fat: f.fat_g, time: new Date().toISOString() });
  saveDay(d);
  go("dashboard");
}

function renderDiet() {
  const d = day();
  const t = totals(d.food);
  const remainingProtein = Math.max(0, state.profile.proteinTarget - t.protein);
  const options = foodPool.filter(f => state.profile.diet === "veg" ? f[6] : true);
  view().innerHTML = `${head("Diet", `${Math.round(remainingProtein)}g protein left today.`)}
    <div class="grid2">
      <div class="card"><h3>Add food manually</h3>
        <label>Name</label><input id="m-name" placeholder="Rice bowl, paneer, chicken...">
        <div class="row"><div><label>Calories</label><input id="m-cal" type="number"></div><div><label>Protein</label><input id="m-pro" type="number"></div></div>
        <div class="row"><div><label>Carbs</label><input id="m-carb" type="number"></div><div><label>Fat</label><input id="m-fat" type="number"></div></div>
        <button class="btn block" style="margin-top:12px" onclick="manualFood()">Add food</button>
      </div>
      <div class="card"><h3>Gap fillers</h3>${options.map(f => `<div class="entry"><div>${f[0]}<span class="tiny">${f[1]} - ${f[3]}g protein</span></div><span class="pill">${Math.ceil(remainingProtein / f[3]) || 1}x</span></div>`).join("")}</div>
    </div>`;
}

function manualFood() {
  const d = day();
  d.food.push({
    name: document.getElementById("m-name").value || "Manual food",
    cal: Number(document.getElementById("m-cal").value || 0),
    protein: Number(document.getElementById("m-pro").value || 0),
    carbs: Number(document.getElementById("m-carb").value || 0),
    fat: Number(document.getElementById("m-fat").value || 0)
  });
  saveDay(d);
  renderDiet();
}

function renderRecovery() {
  const d = day();
  view().innerHTML = `${head("Recovery", "Log sleep and see a simple readiness score.")}
    <div class="grid2">
      <div class="card">
        <label>Bedtime</label><input type="time" id="bed" value="${d.sleep?.bed || "23:00"}">
        <label>Wake time</label><input type="time" id="wake" value="${d.sleep?.wake || "07:00"}">
        <label>Quality 1-5</label><input type="range" min="1" max="5" id="quality" value="${d.sleep?.quality || 4}">
        <button class="btn block" style="margin-top:12px" onclick="saveSleep()">Save sleep</button>
      </div>
      <div class="card">${metric("Recovery score", recoveryScore() ? `${recoveryScore()}%` : "-", d.sleep ? `${d.sleep.duration.toFixed(1)}h sleep` : "No sleep log")}</div>
    </div>`;
}

function saveSleep() {
  const bed = document.getElementById("bed").value;
  const wake = document.getElementById("wake").value;
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  let duration = ((wh * 60 + wm) - (bh * 60 + bm)) / 60;
  if (duration <= 0) duration += 24;
  const d = day();
  d.sleep = { bed, wake, duration, quality: Number(document.getElementById("quality").value) };
  saveDay(d);
  renderRecovery();
}

function recoveryScore() {
  const d = day();
  if (!d.sleep) return null;
  return Math.round((Math.min(1, d.sleep.duration / 8) * .6 + d.sleep.quality / 5 * .4) * 100);
}

function renderWorkouts() {
  const d = day();
  view().innerHTML = `${head("Workouts", "Log sessions and training load.")}
    <div class="grid2">
      <div class="card">
        <label>Type</label><select id="wo-type"><option>Strength training</option><option>Cardio</option><option>HIIT</option><option>Mobility</option></select>
        <label>Duration minutes</label><input id="wo-duration" type="number" value="45">
        <label>RPE 1-10</label><input id="wo-rpe" type="range" min="1" max="10" value="7">
        <label>Calories burned</label><input id="wo-cal" type="number" placeholder="Optional">
        <button class="btn block" style="margin-top:12px" onclick="saveWorkout()">Log workout</button>
      </div>
      <div class="card"><h3>Today's sessions</h3>${d.workouts.length ? d.workouts.map((w, i) => `<div class="entry"><div>${w.type}<span class="tiny">${w.duration} min - RPE ${w.rpe}</span></div><button class="link-btn" onclick="removeWorkout(${i})">Remove</button></div>`).join("") : empty("No workouts yet.")}</div>
    </div>`;
}

function saveWorkout() {
  const d = day();
  d.workouts.push({
    type: document.getElementById("wo-type").value,
    duration: Number(document.getElementById("wo-duration").value || 0),
    rpe: Number(document.getElementById("wo-rpe").value || 1),
    cal: Number(document.getElementById("wo-cal").value || 0)
  });
  saveDay(d);
  renderWorkouts();
}

function removeWorkout(index) {
  const d = day();
  d.workouts.splice(index, 1);
  saveDay(d);
  renderWorkouts();
}

function renderPhotos() {
  const photos = load("photos", []);
  view().innerHTML = `${head("Progress photos", "Add check-in photos and notes.")}
    <div class="card"><label class="upload" for="photo-file">Add progress photo</label><input id="photo-file" type="file" accept="image/*" hidden><label>Note</label><input id="photo-note" placeholder="Front relaxed, week 1..."></div>
    <div class="photo-grid" style="margin-top:14px">${photos.map((p, i) => `<div class="card"><img class="photo-img" src="${p.src}" alt="Progress photo"><p class="tiny">${p.date}</p><p>${p.note}</p><button class="link-btn" onclick="removePhoto(${i})">Remove</button></div>`).join("") || empty("No photos yet.")}</div>`;
  document.getElementById("photo-file").onchange = addPhoto;
}

function addPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const photos = load("photos", []);
    photos.unshift({ src: reader.result, note: document.getElementById("photo-note").value || "Progress photo", date: new Date().toLocaleDateString() });
    save("photos", photos);
    renderPhotos();
  };
  reader.readAsDataURL(file);
}

function removePhoto(index) {
  const photos = load("photos", []);
  photos.splice(index, 1);
  save("photos", photos);
  renderPhotos();
}

function renderCoach() {
  view().innerHTML = `${head("AI Coach", "Ask training, diet, recovery, and progress questions.")}
    <div class="card"><div class="chat-log" id="chat-log">${state.chat.map(m => `<div class="msg ${m.role}">${escapeHtml(m.text)}</div>`).join("") || empty("Ask your first question.")}</div>
    <div class="row"><input id="chat-input" placeholder="Ask your coach..."><button class="btn" onclick="sendChat()">Send</button></div></div>`;
  document.getElementById("chat-input").onkeydown = e => {
    if (e.key === "Enter") sendChat();
  };
}

async function sendChat() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  if (!state.session) {
    state.chat.push({ role: "assistant", text: "Please sign in first so the coach can respond." });
    save("chat", state.chat);
    renderCoach();
    return;
  }
  input.value = "";
  state.chat.push({ role: "user", text: message });
  save("chat", state.chat);
  renderCoach();
  state.chat.push({ role: "assistant", text: "Thinking..." });
  renderCoach();
  const d = day();
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.session.access_token}` },
      body: JSON.stringify({ message, history: state.chat.slice(0, -1), profile: state.profile, today: { totals: totals(d.food), workouts: d.workouts, sleep: d.sleep }, recovery: recoveryScore() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.chat[state.chat.length - 1] = { role: "assistant", text: data.reply };
  } catch (error) {
    state.chat[state.chat.length - 1] = { role: "assistant", text: `Coach is unavailable right now: ${error.message}` };
  }
  save("chat", state.chat);
  renderCoach();
}

function renderSettings() {
  const p = state.profile;
  view().innerHTML = `${head("Settings", "Profile targets and login configuration.")}
    <div class="grid2">
      <div class="card">
        <label>Sex</label><select id="sex"><option value="male">Male</option><option value="female">Female</option></select>
        <div class="row"><div><label>Weight kg</label><input id="weight" type="number" value="${p.weight}"></div><div><label>Height cm</label><input id="height" type="number" value="${p.height}"></div></div>
        <div class="row"><div><label>Age</label><input id="age" type="number" value="${p.age}"></div><div><label>Diet</label><select id="diet"><option value="nonveg">Non-veg</option><option value="veg">Veg</option></select></div></div>
        <label>Goal</label><select id="goal"><option value="cut">Cut</option><option value="recomp">Recomp</option><option value="bulk">Bulk</option></select>
        <button class="btn block" style="margin-top:12px" onclick="saveProfile()">Save profile</button>
      </div>
      <div class="card"><h3>Deployment note</h3><p class="sub">Set Supabase keys in Vercel to enable real email login. Without them, the app uses local preview mode after you enter an email.</p><p class="sub">Razorpay payouts go to the bank/UPI configured in your Razorpay merchant account.</p></div>
    </div>`;
  ["sex", "diet", "goal"].forEach(id => document.getElementById(id).value = p[id]);
}

function saveProfile() {
  const profile = {
    sex: document.getElementById("sex").value,
    weight: Number(document.getElementById("weight").value || defaults.weight),
    height: Number(document.getElementById("height").value || defaults.height),
    age: Number(document.getElementById("age").value || defaults.age),
    diet: document.getElementById("diet").value,
    activity: 1.45,
    goal: document.getElementById("goal").value
  };
  state.profile = { ...profile, ...computeTargets(profile) };
  save("profile", state.profile);
  renderSettings();
}

function openAuth() {
  document.getElementById("auth-dialog").showModal();
}

async function sendMagicLink() {
  const email = document.getElementById("email-input").value.trim();
  const msg = document.getElementById("auth-message");
  if (!email) return;
  if (!state.supabase) {
    state.email = email;
    localStorage.setItem("ironlog_email", email);
    msg.textContent = "Preview login enabled. Add Supabase env vars for real email links.";
    render();
    return;
  }
  const { error } = await state.supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin }
  });
  msg.textContent = error ? error.message : "Login link sent. Check your inbox.";
}

async function authAction() {
  if (state.session && state.supabase) await state.supabase.auth.signOut();
  state.session = null;
  state.email = "";
  localStorage.removeItem("ironlog_email");
  render();
}

async function startPayment(plan) {
  if (!state.email) return openAuth();
  try {
    const res = await fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, email: state.email })
    });
    const order = await res.json();
    if (!res.ok) throw new Error(order.error);
    const checkout = new Razorpay({
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: "IRONLOG",
      description: order.name,
      order_id: order.orderId,
      prefill: { email: state.email },
      handler: response => verifyPayment(response, plan),
      theme: { color: "#e05243" }
    });
    checkout.open();
  } catch (error) {
    alert(`Payment setup failed: ${error.message}`);
  }
}

async function verifyPayment(response, plan) {
  const res = await fetch("/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...response, plan })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || "Payment verification failed");
  localStorage.setItem("ironlog_paid_until", data.accessUntil);
  alert("Payment verified. IRONLOG access activated.");
  render();
}

function go(tab) {
  state.tab = tab;
  render();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
