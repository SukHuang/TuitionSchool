BEGIN;

DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS teachers;

CREATE TABLE teachers (
  teacher_id SERIAL PRIMARY KEY,
  teacher_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  subject_specialty TEXT NOT NULL DEFAULT '',
  class_id INTEGER UNIQUE,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Inactive'))
);

CREATE TABLE classes (
  class_id SERIAL PRIMARY KEY,
  class_code TEXT NOT NULL UNIQUE,
  class_name TEXT NOT NULL,
  subjects TEXT NOT NULL DEFAULT '',
  schedule_days TEXT NOT NULL DEFAULT '',
  schedule_time TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER UNIQUE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE students (
  student_id SERIAL PRIMARY KEY,
  student_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '',
  age INTEGER,
  class_id INTEGER NOT NULL,
  guardian_name TEXT NOT NULL DEFAULT '',
  guardian_phone TEXT NOT NULL DEFAULT '',
  guardian_email TEXT NOT NULL DEFAULT '',
  enrolment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Withdrawn')),
  CONSTRAINT fk_students_class
    FOREIGN KEY (class_id) REFERENCES classes(class_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

ALTER TABLE classes
  ADD CONSTRAINT fk_classes_teacher
  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE teachers
  ADD CONSTRAINT fk_teachers_class
  FOREIGN KEY (class_id) REFERENCES classes(class_id)
  ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_teachers_class_id ON teachers(class_id);

COMMIT;
