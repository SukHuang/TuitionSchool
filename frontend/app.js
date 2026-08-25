const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:3000";

const state = {
  classes: [],
  teachers: [],
  students: [],
  dashboard: { classes: 0, teachers: 0, students: 0 },
};

const els = {
  statusBar: document.getElementById("statusBar"),
  dashboardCards: document.getElementById("dashboardCards"),
  classList: document.getElementById("classList"),
  teacherList: document.getElementById("teacherList"),
  studentList: document.getElementById("studentList"),
  classDetail: document.getElementById("classDetail"),
  studentClassId: document.getElementById("studentClassId"),
  studentClassFilter: document.getElementById("studentClassFilter"),
  classTeacherId: document.getElementById("classTeacherId"),
  teacherClassId: document.getElementById("teacherClassId"),
  classSearch: document.getElementById("classSearch"),
  teacherSearch: document.getElementById("teacherSearch"),
  studentSearch: document.getElementById("studentSearch"),
};

function showStatus(message, isError = false) {
  els.statusBar.classList.remove("hidden");
  els.statusBar.classList.toggle("error", isError);
  els.statusBar.textContent = message;
}

function clearStatus() {
  els.statusBar.classList.add("hidden");
  els.statusBar.classList.remove("error");
  els.statusBar.textContent = "";
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((el) => el.classList.remove("active"));
      document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    });
  });
}

function optionHtml(value, label) {
  return `<option value="${value}">${label}</option>`;
}

function fillClassOptions() {
  const classOptions = state.classes.map((c) => optionHtml(c.class_id, `${c.class_code} - ${c.class_name}`)).join("");
  const teacherOptions = state.teachers
    .filter((t) => !t.class_id)
    .map((t) => optionHtml(t.teacher_id, `${t.teacher_code} - ${t.full_name}`))
    .join("");

  els.studentClassId.innerHTML = `<option value="">Select class</option>${classOptions}`;
  els.studentClassFilter.innerHTML = `<option value="">All classes</option>${classOptions}`;
  els.classTeacherId.innerHTML = `<option value="">Unassigned</option>${teacherOptions}`;

  const freeClasses = state.classes.filter((c) => !c.teacher_id);
  els.teacherClassId.innerHTML = `<option value="">Unassigned</option>${freeClasses
    .map((c) => optionHtml(c.class_id, `${c.class_code} - ${c.class_name}`))
    .join("")}`;
}

function renderDashboard() {
  els.dashboardCards.innerHTML = `
    <article class="card"><h4>Total Classes</h4><p>${state.dashboard.classes}</p></article>
    <article class="card"><h4>Total Teachers</h4><p>${state.dashboard.teachers}</p></article>
    <article class="card"><h4>Total Students</h4><p>${state.dashboard.students}</p></article>
  `;
}

function renderClasses() {
  const q = els.classSearch.value.toLowerCase();
  const rows = state.classes.filter((c) => `${c.class_code} ${c.class_name}`.toLowerCase().includes(q));

  els.classList.innerHTML = rows
    .map(
      (c) => `
      <article class="card">
        <h4>${c.class_name} <small>(${c.class_code})</small></h4>
        <p>Subjects: ${c.subjects || "-"}</p>
        <p>Schedule: ${c.schedule_days || "-"} ${c.schedule_time || ""}</p>
        <p>Room: ${c.room || "-"}</p>
        <p>Teacher: ${c.teacher_name || "Unassigned"}</p>
        <p>Students: ${c.student_count}</p>
        <p>Status: ${c.status}</p>
        <div class="row-actions">
          <button data-action="class-detail" data-id="${c.class_id}">Detail</button>
          <button class="ghost" data-action="class-edit" data-id="${c.class_id}">Edit</button>
          <button class="danger" data-action="class-delete" data-id="${c.class_id}">Delete</button>
        </div>
      </article>`
    )
    .join("");
}

function renderTeachers() {
  const q = els.teacherSearch.value.toLowerCase();
  const rows = state.teachers.filter((t) => `${t.teacher_code} ${t.full_name}`.toLowerCase().includes(q));

  els.teacherList.innerHTML = rows
    .map(
      (t) => `
      <article class="card">
        <h4>${t.full_name} <small>(${t.teacher_code})</small></h4>
        <p>Email: ${t.email || "-"}</p>
        <p>Phone: ${t.phone || "-"}</p>
        <p>Subject: ${t.subject_specialty || "-"}</p>
        <p>Class: ${t.class_name || "Unassigned"}</p>
        <p>Status: ${t.status}</p>
        <div class="row-actions">
          <button class="ghost" data-action="teacher-edit" data-id="${t.teacher_id}">Edit</button>
          <button class="danger" data-action="teacher-delete" data-id="${t.teacher_id}">Delete</button>
        </div>
      </article>`
    )
    .join("");
}

function renderStudents() {
  const q = els.studentSearch.value.toLowerCase();
  const classFilter = els.studentClassFilter.value;
  const rows = state.students.filter((s) => {
    const matchText = `${s.student_code} ${s.full_name}`.toLowerCase().includes(q);
    const matchClass = !classFilter || String(s.class_id) === classFilter;
    return matchText && matchClass;
  });

  els.studentList.innerHTML = rows
    .map(
      (s) => `
      <article class="card">
        <h4>${s.full_name} <small>(${s.student_code})</small></h4>
        <p>Class: ${s.class_name}</p>
        <p>Gender/Age: ${s.gender || "-"} ${s.age || ""}</p>
        <p>Guardian: ${s.guardian_name || "-"} (${s.guardian_phone || "-"})</p>
        <p>Status: ${s.status}</p>
        <div class="row-actions">
          <button class="ghost" data-action="student-edit" data-id="${s.student_id}">Edit</button>
          <button class="danger" data-action="student-delete" data-id="${s.student_id}">Delete</button>
        </div>
      </article>`
    )
    .join("");
}

async function loadAll() {
  showStatus("Loading data... If the API was sleeping, this can take up to 60 seconds.");
  try {
    const [dashboard, classes, teachers, students] = await Promise.all([
      api("/api/dashboard"),
      api("/api/classes"),
      api("/api/teachers"),
      api("/api/students"),
    ]);
    state.dashboard = dashboard;
    state.classes = classes;
    state.teachers = teachers;
    state.students = students;
    fillClassOptions();
    renderDashboard();
    renderClasses();
    renderTeachers();
    renderStudents();
    clearStatus();
  } catch (error) {
    showStatus(error.message, true);
  }
}

function resetClassForm() {
  document.getElementById("classForm").reset();
  document.getElementById("classId").value = "";
  document.getElementById("classFormTitle").textContent = "Create Class";
}

function resetTeacherForm() {
  document.getElementById("teacherForm").reset();
  document.getElementById("teacherId").value = "";
  document.getElementById("teacherFormTitle").textContent = "Create Teacher";
}

function resetStudentForm() {
  document.getElementById("studentForm").reset();
  document.getElementById("studentId").value = "";
  document.getElementById("studentFormTitle").textContent = "Create Student";
}

async function loadClassDetail(classId) {
  try {
    const detail = await api(`/api/classes/${classId}`);
    const students = detail.students
      .map((s) => `<li>${s.student_code} - ${s.full_name} (${s.status})</li>`)
      .join("");
    els.classDetail.classList.remove("hidden");
    els.classDetail.innerHTML = `
      <h4>Class Detail: ${detail.class_name}</h4>
      <p>Teacher: ${detail.teacher_name || "Unassigned"}</p>
      <p>Teacher Contact: ${detail.teacher_email || "-"} / ${detail.teacher_phone || "-"}</p>
      <p>Students:</p>
      <ul>${students || "<li>No students</li>"}</ul>
    `;
  } catch (error) {
    showStatus(error.message, true);
  }
}

function bindEvents() {
  els.classSearch.addEventListener("input", renderClasses);
  els.teacherSearch.addEventListener("input", renderTeachers);
  els.studentSearch.addEventListener("input", renderStudents);
  els.studentClassFilter.addEventListener("change", renderStudents);

  document.getElementById("classCancel").addEventListener("click", resetClassForm);
  document.getElementById("teacherCancel").addEventListener("click", resetTeacherForm);
  document.getElementById("studentCancel").addEventListener("click", resetStudentForm);

  document.getElementById("studentClassId").addEventListener("change", async (e) => {
    const studentId = document.getElementById("studentId").value;
    if (studentId) return;
    if (!e.target.value) return;
    try {
      const suggestion = await api(`/api/classes/${e.target.value}/next-student-code`);
      document.getElementById("studentCode").value = suggestion.student_code;
    } catch {
      // Keep manual input available even if suggestion endpoint fails.
    }
  });

  document.getElementById("classForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const classId = document.getElementById("classId").value;
    const payload = {
      class_code: document.getElementById("classCode").value.trim(),
      class_name: document.getElementById("className").value.trim(),
      subjects: document.getElementById("classSubjects").value.trim(),
      schedule_days: document.getElementById("classDays").value.trim(),
      schedule_time: document.getElementById("classTime").value.trim(),
      room: document.getElementById("classRoom").value.trim(),
      teacher_id: document.getElementById("classTeacherId").value || null,
      status: document.getElementById("classStatus").value,
    };
    try {
      showStatus("Saving class...");
      if (classId) {
        await api(`/api/classes/${classId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/classes", { method: "POST", body: JSON.stringify(payload) });
      }
      resetClassForm();
      await loadAll();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  document.getElementById("teacherForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const teacherId = document.getElementById("teacherId").value;
    const payload = {
      teacher_code: document.getElementById("teacherCode").value.trim(),
      full_name: document.getElementById("teacherName").value.trim(),
      email: document.getElementById("teacherEmail").value.trim(),
      phone: document.getElementById("teacherPhone").value.trim(),
      subject_specialty: document.getElementById("teacherSubject").value.trim(),
      class_id: document.getElementById("teacherClassId").value || null,
      join_date: document.getElementById("teacherJoinDate").value,
      status: document.getElementById("teacherStatus").value,
    };
    try {
      showStatus("Saving teacher...");
      if (teacherId) {
        await api(`/api/teachers/${teacherId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/teachers", { method: "POST", body: JSON.stringify(payload) });
      }
      resetTeacherForm();
      await loadAll();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  document.getElementById("studentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentId = document.getElementById("studentId").value;
    const payload = {
      student_code: document.getElementById("studentCode").value.trim(),
      full_name: document.getElementById("studentName").value.trim(),
      gender: document.getElementById("studentGender").value.trim(),
      age: document.getElementById("studentAge").value.trim() || null,
      class_id: document.getElementById("studentClassId").value,
      guardian_name: document.getElementById("guardianName").value.trim(),
      guardian_phone: document.getElementById("guardianPhone").value.trim(),
      guardian_email: document.getElementById("guardianEmail").value.trim(),
      enrolment_date: document.getElementById("studentEnrolDate").value,
      status: document.getElementById("studentStatus").value,
    };
    try {
      showStatus("Saving student...");
      if (studentId) {
        await api(`/api/students/${studentId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/students", { method: "POST", body: JSON.stringify(payload) });
      }
      resetStudentForm();
      await loadAll();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  document.body.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "class-detail") return loadClassDetail(id);

    if (action === "class-edit") {
      const row = state.classes.find((c) => String(c.class_id) === id);
      if (!row) return;
      document.getElementById("classFormTitle").textContent = "Edit Class";
      document.getElementById("classId").value = row.class_id;
      document.getElementById("classCode").value = row.class_code;
      document.getElementById("className").value = row.class_name;
      document.getElementById("classSubjects").value = row.subjects || "";
      document.getElementById("classDays").value = row.schedule_days || "";
      document.getElementById("classTime").value = row.schedule_time || "";
      document.getElementById("classRoom").value = row.room || "";
      document.getElementById("classStatus").value = row.status || "Active";
      document.getElementById("classTeacherId").value = row.teacher_id || "";
      return;
    }

    if (action === "teacher-edit") {
      const row = state.teachers.find((t) => String(t.teacher_id) === id);
      if (!row) return;
      document.getElementById("teacherFormTitle").textContent = "Edit Teacher";
      document.getElementById("teacherId").value = row.teacher_id;
      document.getElementById("teacherCode").value = row.teacher_code;
      document.getElementById("teacherName").value = row.full_name;
      document.getElementById("teacherEmail").value = row.email || "";
      document.getElementById("teacherPhone").value = row.phone || "";
      document.getElementById("teacherSubject").value = row.subject_specialty || "";
      document.getElementById("teacherJoinDate").value = row.join_date || "";
      document.getElementById("teacherStatus").value = row.status || "Active";

      const currentOption = `<option value="${row.class_id || ""}" selected>${
        row.class_name ? `${row.class_code} - ${row.class_name}` : "Unassigned"
      }</option>`;
      const extra = state.classes
        .filter((c) => !c.teacher_id || c.class_id === row.class_id)
        .map((c) => optionHtml(c.class_id, `${c.class_code} - ${c.class_name}`))
        .join("");
      els.teacherClassId.innerHTML = `<option value="">Unassigned</option>${currentOption}${extra}`;
      document.getElementById("teacherClassId").value = row.class_id || "";
      return;
    }

    if (action === "student-edit") {
      const row = state.students.find((s) => String(s.student_id) === id);
      if (!row) return;
      document.getElementById("studentFormTitle").textContent = "Edit Student";
      document.getElementById("studentId").value = row.student_id;
      document.getElementById("studentClassId").value = row.class_id;
      document.getElementById("studentCode").value = row.student_code;
      document.getElementById("studentName").value = row.full_name;
      document.getElementById("studentGender").value = row.gender || "";
      document.getElementById("studentAge").value = row.age || "";
      document.getElementById("guardianName").value = row.guardian_name || "";
      document.getElementById("guardianPhone").value = row.guardian_phone || "";
      document.getElementById("guardianEmail").value = row.guardian_email || "";
      document.getElementById("studentEnrolDate").value = row.enrolment_date || "";
      document.getElementById("studentStatus").value = row.status || "Active";
      return;
    }

    if (action.endsWith("-delete")) {
      const labels = {
        "class-delete": "class",
        "teacher-delete": "teacher",
        "student-delete": "student",
      };
      if (!window.confirm(`Delete this ${labels[action]}? This cannot be undone.`)) return;

      try {
        showStatus("Deleting record...");
        if (action === "class-delete") await api(`/api/classes/${id}`, { method: "DELETE" });
        if (action === "teacher-delete") await api(`/api/teachers/${id}`, { method: "DELETE" });
        if (action === "student-delete") await api(`/api/students/${id}`, { method: "DELETE" });
        await loadAll();
      } catch (error) {
        showStatus(error.message, true);
      }
    }
  });
}

initTabs();
bindEvents();
loadAll();
