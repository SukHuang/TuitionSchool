const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:3000";

const state = {
  classes: [],
  teachers: [],
  students: [],
  dashboard: { classes: 0, teachers: 0, students: 0 },
  editingClassId: null,
  editingTeacherId: null,
  editingStudentId: null,
};

const els = {
  statusBar: document.getElementById("statusBar"),
  dashboardCards: document.getElementById("dashboardCards"),
  enrollmentCards: document.getElementById("enrollmentCards"),
  classList: document.getElementById("classList"),
  teacherList: document.getElementById("teacherList"),
  studentList: document.getElementById("studentList"),
  classDetailModal: document.getElementById("classDetailModal"),
  classDetailContent: document.getElementById("classDetailContent"),
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

  if (!els.enrollmentCards) return;
  els.enrollmentCards.innerHTML = state.classes
    .map((c) => {
      const count = state.students.filter((s) => Number(s.class_id) === Number(c.class_id)).length;
      return `<article class="card"><h4>${c.class_code}</h4><p>${c.class_name}</p><p>Students: ${count}</p></article>`;
    })
    .join("");
}

function renderClasses() {
  const q = els.classSearch.value.toLowerCase();
  const rows = state.classes.filter((c) => `${c.class_code} ${c.class_name}`.toLowerCase().includes(q));

  els.classList.innerHTML = rows
    .map((c) => {
      const isEditing = state.editingClassId === c.class_id;
      if (isEditing) {
        const teacherOptions = state.teachers
          .filter((t) => !t.class_id || t.class_id === c.class_id)
          .map((t) => `<option value="${t.teacher_id}" ${t.class_id === c.class_id ? "selected" : ""}>${t.teacher_code} - ${t.full_name}</option>`)
          .join("");
        return `
        <article class="card" data-class-edit="${c.class_id}">
          <h4>Editing Class</h4>
          <div class="form-grid" style="gap: 8px;">
            <label>Code<input type="text" class="inline-edit-code" value="${c.class_code}" /></label>
            <label>Name<input type="text" class="inline-edit-name" value="${c.class_name}" /></label>
            <label>Subjects<input type="text" class="inline-edit-subjects" value="${c.subjects || ""}" /></label>
            <label>Days<input type="text" class="inline-edit-days" value="${c.schedule_days || ""}" /></label>
            <label>Time<input type="text" class="inline-edit-time" value="${c.schedule_time || ""}" /></label>
            <label>Room<input type="text" class="inline-edit-room" value="${c.room || ""}" /></label>
            <label>Teacher<select class="inline-edit-teacher"><option value="">Unassigned</option>${teacherOptions}</select></label>
            <label>Status<select class="inline-edit-status"><option value="Active" ${c.status === "Active" ? "selected" : ""}>Active</option><option value="Inactive" ${c.status === "Inactive" ? "selected" : ""}>Inactive</option></select></label>
          </div>
          <div class="row-actions">
            <button class="ghost" data-action="class-save-inline" data-id="${c.class_id}">Save</button>
            <button class="danger" data-action="class-cancel-inline" data-id="${c.class_id}">Cancel</button>
          </div>
        </article>`;
      }
      return `
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
          <button class="ghost" data-action="class-edit-inline" data-id="${c.class_id}">Edit</button>
          <button class="danger" data-action="class-delete" data-id="${c.class_id}">Delete</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderTeachers() {
  const q = els.teacherSearch.value.toLowerCase();
  const rows = state.teachers.filter((t) => `${t.teacher_code} ${t.full_name}`.toLowerCase().includes(q));

  els.teacherList.innerHTML = rows
    .map((t) => {
      const isEditing = state.editingTeacherId === t.teacher_id;
      if (isEditing) {
        const classOptions = state.classes
          .filter((c) => !c.teacher_id || c.class_id === t.class_id)
          .map((c) => `<option value="${c.class_id}" ${c.class_id === t.class_id ? "selected" : ""}>${c.class_code} - ${c.class_name}</option>`)
          .join("");
        return `
        <article class="card" data-teacher-edit="${t.teacher_id}">
          <h4>Editing Teacher</h4>
          <div class="form-grid" style="gap: 8px;">
            <label>Code<input type="text" class="inline-edit-code" value="${t.teacher_code}" /></label>
            <label>Name<input type="text" class="inline-edit-name" value="${t.full_name}" /></label>
            <label>Email<input type="email" class="inline-edit-email" value="${t.email || ""}" /></label>
            <label>Phone<input type="tel" class="inline-edit-phone" value="${t.phone || ""}" /></label>
            <label>Subject<input type="text" class="inline-edit-subject" value="${t.subject_specialty || ""}" /></label>
            <label>Join Date<input type="date" class="inline-edit-joindate" value="${t.join_date || ""}" /></label>
            <label>Class<select class="inline-edit-class"><option value="">Unassigned</option>${classOptions}</select></label>
            <label>Status<select class="inline-edit-status"><option value="Active" ${t.status === "Active" ? "selected" : ""}>Active</option><option value="On Leave" ${t.status === "On Leave" ? "selected" : ""}>On Leave</option><option value="Inactive" ${t.status === "Inactive" ? "selected" : ""}>Inactive</option></select></label>
          </div>
          <div class="row-actions">
            <button class="ghost" data-action="teacher-save-inline" data-id="${t.teacher_id}">Save</button>
            <button class="danger" data-action="teacher-cancel-inline" data-id="${t.teacher_id}">Cancel</button>
          </div>
        </article>`;
      }
      return `
      <article class="card">
        <h4>${t.full_name} <small>(${t.teacher_code})</small></h4>
        <p>Email: ${t.email || "-"}</p>
        <p>Phone: ${t.phone || "-"}</p>
        <p>Subject: ${t.subject_specialty || "-"}</p>
        <p>Class: ${t.class_name || "Unassigned"}</p>
        <p>Status: ${t.status}</p>
        <div class="row-actions">
          <button class="ghost" data-action="teacher-edit-inline" data-id="${t.teacher_id}">Edit</button>
          <button class="danger" data-action="teacher-delete" data-id="${t.teacher_id}">Delete</button>
        </div>
      </article>`;
    })
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
    .map((s) => {
      const isEditing = state.editingStudentId === s.student_id;
      if (isEditing) {
        const classOptions = state.classes
          .map((c) => `<option value="${c.class_id}" ${c.class_id === s.class_id ? "selected" : ""}>${c.class_code} - ${c.class_name}</option>`)
          .join("");
        return `
        <article class="card" data-student-edit="${s.student_id}">
          <h4>Editing Student</h4>
          <div class="form-grid" style="gap: 8px;">
            <label>Class<select class="inline-edit-class" required>${classOptions}</select></label>
            <label>Code<input type="text" class="inline-edit-code" value="${s.student_code}" /></label>
            <label>Name<input type="text" class="inline-edit-name" value="${s.full_name}" /></label>
            <label>Gender<input type="text" class="inline-edit-gender" value="${s.gender || ""}" /></label>
            <label>Age<input type="number" class="inline-edit-age" value="${s.age || ""}" /></label>
            <label>Guardian<input type="text" class="inline-edit-guardian" value="${s.guardian_name || ""}" /></label>
            <label>Phone<input type="tel" class="inline-edit-phone" value="${s.guardian_phone || ""}" /></label>
            <label>Email<input type="email" class="inline-edit-email" value="${s.guardian_email || ""}" /></label>
            <label>Enrol Date<input type="date" class="inline-edit-enrol" value="${s.enrolment_date || ""}" /></label>
            <label>Status<select class="inline-edit-status"><option value="Active" ${s.status === "Active" ? "selected" : ""}>Active</option><option value="Withdrawn" ${s.status === "Withdrawn" ? "selected" : ""}>Withdrawn</option></select></label>
          </div>
          <div class="row-actions">
            <button class="ghost" data-action="student-save-inline" data-id="${s.student_id}">Save</button>
            <button class="danger" data-action="student-cancel-inline" data-id="${s.student_id}">Cancel</button>
          </div>
        </article>`;
      }
      return `
      <article class="card">
        <h4>${s.full_name} <small>(${s.student_code})</small></h4>
        <p>Class: ${s.class_name}</p>
        <p>Gender/Age: ${s.gender || "-"} ${s.age || ""}</p>
        <p>Guardian: ${s.guardian_name || "-"} (${s.guardian_phone || "-"})</p>
        <p>Status: ${s.status}</p>
        <div class="row-actions">
          <button class="ghost" data-action="student-edit-inline" data-id="${s.student_id}">Edit</button>
          <button class="danger" data-action="student-delete" data-id="${s.student_id}">Delete</button>
        </div>
      </article>`;
    })
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
  document.getElementById("classFormContainer").classList.add("hidden");
}

function resetTeacherForm() {
  document.getElementById("teacherForm").reset();
  document.getElementById("teacherId").value = "";
  document.getElementById("teacherFormTitle").textContent = "Create Teacher";
  document.getElementById("teacherFormContainer").classList.add("hidden");
}

function resetStudentForm() {
  document.getElementById("studentForm").reset();
  document.getElementById("studentId").value = "";
  document.getElementById("studentFormTitle").textContent = "Create Student";
  document.getElementById("studentFormContainer").classList.add("hidden");
}

async function loadClassDetail(classId) {
  try {
    const detail = await api(`/api/classes/${classId}`);
    const students = detail.students
      .map((s) => `<li>${s.student_code} - ${s.full_name} (${s.status})</li>`)
      .join("");
    els.classDetailContent.innerHTML = `
      <h3>${detail.class_name}</h3>
      <p><strong>Code:</strong> ${detail.class_code}</p>
      <p><strong>Teacher:</strong> ${detail.teacher_name || "Unassigned"}</p>
      <p><strong>Teacher Contact:</strong> ${detail.teacher_email || "-"} / ${detail.teacher_phone || "-"}</p>
      <p><strong>Students Enrolled:</strong></p>
      <ul>${students || "<li>No students</li>"}</ul>
    `;
    els.classDetailModal.classList.remove("hidden");
  } catch (error) {
    showStatus(error.message, true);
  }
}

function bindEvents() {
  els.classSearch.addEventListener("input", renderClasses);
  els.teacherSearch.addEventListener("input", renderTeachers);
  els.studentSearch.addEventListener("input", renderStudents);
  els.studentClassFilter.addEventListener("change", renderStudents);

  // Add button handlers to show forms
  document.getElementById("classAddBtn").addEventListener("click", () => {
    document.getElementById("classFormContainer").classList.remove("hidden");
  });
  document.getElementById("teacherAddBtn").addEventListener("click", () => {
    document.getElementById("teacherFormContainer").classList.remove("hidden");
  });
  document.getElementById("studentAddBtn").addEventListener("click", () => {
    document.getElementById("studentFormContainer").classList.remove("hidden");
  });

  document.getElementById("classCancel").addEventListener("click", resetClassForm);
  document.getElementById("teacherCancel").addEventListener("click", resetTeacherForm);
  document.getElementById("studentCancel").addEventListener("click", resetStudentForm);

  // Close modal when clicking overlay
  els.classDetailModal.addEventListener("click", (e) => {
    if (e.target === els.classDetailModal) {
      els.classDetailModal.classList.add("hidden");
    }
  });

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

    if (action === "close-class-detail") {
      els.classDetailModal.classList.add("hidden");
      return;
    }

    if (action === "class-detail") {
      return loadClassDetail(id);
    }

    if (action === "class-edit-inline") {
      state.editingClassId = Number(id);
      renderClasses();
      return;
    }

    if (action === "class-cancel-inline") {
      state.editingClassId = null;
      renderClasses();
      return;
    }

    if (action === "class-save-inline") {
      const row = state.classes.find((c) => String(c.class_id) === id);
      if (!row) return;
      const card = document.querySelector(`[data-class-edit="${id}"]`);
      if (!card) return;
      const payload = {
        class_code: card.querySelector(".inline-edit-code").value.trim(),
        class_name: card.querySelector(".inline-edit-name").value.trim(),
        subjects: card.querySelector(".inline-edit-subjects").value.trim(),
        schedule_days: card.querySelector(".inline-edit-days").value.trim(),
        schedule_time: card.querySelector(".inline-edit-time").value.trim(),
        room: card.querySelector(".inline-edit-room").value.trim(),
        teacher_id: card.querySelector(".inline-edit-teacher").value || null,
        status: card.querySelector(".inline-edit-status").value,
      };
      try {
        showStatus("Saving class...");
        await api(`/api/classes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        state.editingClassId = null;
        await loadAll();
      } catch (error) {
        showStatus(error.message, true);
      }
      return;
    }

    if (action === "teacher-edit-inline") {
      state.editingTeacherId = Number(id);
      renderTeachers();
      return;
    }

    if (action === "teacher-cancel-inline") {
      state.editingTeacherId = null;
      renderTeachers();
      return;
    }

    if (action === "teacher-save-inline") {
      const row = state.teachers.find((t) => String(t.teacher_id) === id);
      if (!row) return;
      const card = document.querySelector(`[data-teacher-edit="${id}"]`);
      if (!card) return;
      const payload = {
        teacher_code: card.querySelector(".inline-edit-code").value.trim(),
        full_name: card.querySelector(".inline-edit-name").value.trim(),
        email: card.querySelector(".inline-edit-email").value.trim(),
        phone: card.querySelector(".inline-edit-phone").value.trim(),
        subject_specialty: card.querySelector(".inline-edit-subject").value.trim(),
        class_id: card.querySelector(".inline-edit-class").value || null,
        join_date: card.querySelector(".inline-edit-joindate").value,
        status: card.querySelector(".inline-edit-status").value,
      };
      try {
        showStatus("Saving teacher...");
        await api(`/api/teachers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        state.editingTeacherId = null;
        await loadAll();
      } catch (error) {
        showStatus(error.message, true);
      }
      return;
    }

    if (action === "student-edit-inline") {
      state.editingStudentId = Number(id);
      renderStudents();
      return;
    }

    if (action === "student-cancel-inline") {
      state.editingStudentId = null;
      renderStudents();
      return;
    }

    if (action === "student-save-inline") {
      const row = state.students.find((s) => String(s.student_id) === id);
      if (!row) return;
      const card = document.querySelector(`[data-student-edit="${id}"]`);
      if (!card) return;
      const payload = {
        student_code: card.querySelector(".inline-edit-code").value.trim(),
        full_name: card.querySelector(".inline-edit-name").value.trim(),
        gender: card.querySelector(".inline-edit-gender").value.trim(),
        age: card.querySelector(".inline-edit-age").value.trim() || null,
        class_id: card.querySelector(".inline-edit-class").value,
        guardian_name: card.querySelector(".inline-edit-guardian").value.trim(),
        guardian_phone: card.querySelector(".inline-edit-phone").value.trim(),
        guardian_email: card.querySelector(".inline-edit-email").value.trim(),
        enrolment_date: card.querySelector(".inline-edit-enrol").value,
        status: card.querySelector(".inline-edit-status").value,
      };
      try {
        showStatus("Saving student...");
        await api(`/api/students/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        state.editingStudentId = null;
        await loadAll();
      } catch (error) {
        showStatus(error.message, true);
      }
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

