-- Tugas 1: Tambahkan satu personal dalam table dengan nama employee Albert dengan posisi enginner, join date 24 Januari 2024, dengan Year of experience 2.5 year. With salary $50.
INSERT INTO employees (name, position, join_date, release_date, years_experience, salary)
VALUES ('Albert', 'Engineer', '2024-01-24', NULL, 2.5, 50);

-- Tugas 2: Update table dengan posisi enginner with salaray $85
UPDATE employees SET salary = 85 WHERE lower(position) = 'engineer';

-- Tugas 3: Hitung total pengeluaran salary saat tahun 2021.
SELECT SUM(salary) AS total_salary_2021
FROM employees
WHERE release_date IS NULL AND (join_date <= '2021-12-31' OR release_date >= '2021-01-01');

-- Tugas 4: Sorting menampilkan 3 employee paling banyak yang memiliki Years of Experience
SELECT name, position, years_experience
FROM employees
ORDER BY years_experience DESC, name ASC
LIMIT 3;

-- Tugas 5: Tuliskan subquery untuk employee dengan posisi engginer yang memiliki exeperience kurang dari sama dengan 3 tahun
SELECT name, position, years_experience
FROM employees
WHERE id IN (
  SELECT id FROM employees
  WHERE lower(position) = 'engineer' AND years_experience <= 3
)
ORDER BY years_experience DESC, name ASC;
