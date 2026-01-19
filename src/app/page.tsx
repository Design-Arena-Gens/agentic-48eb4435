"use client";

import { useEffect, useMemo, useState } from "react";

type WorkoutSet = {
  id: string;
  reps: number;
  weight?: number;
};

type ExerciseEntry = {
  id: string;
  name: string;
  notes?: string;
  sets: WorkoutSet[];
};

type WorkoutSession = {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  title?: string;
  notes?: string;
  exercises: ExerciseEntry[];
  createdAt: string;
};

type ExerciseDraft = {
  id: string;
  name: string;
  notes: string;
  sets: {
    id: string;
    reps: string;
    weight: string;
  }[];
};

const STORAGE_KEY = "workout-tracker-sessions";

const todayISO = () => new Date().toISOString().slice(0, 10);

const createId = () => {
  const globalScope = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (globalScope.crypto?.randomUUID) {
    return globalScope.crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 11)}`;
};

const newExerciseDraft = (): ExerciseDraft => ({
  id: createId(),
  name: "",
  notes: "",
  sets: [
    {
      id: createId(),
      reps: "",
      weight: "",
    },
  ],
});

export default function Home() {
  const [date, setDate] = useState<string>(todayISO);
  const [title, setTitle] = useState<string>("");
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([newExerciseDraft()]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as WorkoutSession[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse workout data", error);
      return [];
    }
  });
  const [search, setSearch] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  }, [workouts]);

  useEffect(() => {
    if (!feedback && !error) return;
    const timer = window.setTimeout(() => {
      setFeedback(null);
      setError(null);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [feedback, error]);

  const filteredWorkouts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...workouts].sort((a, b) => {
      if (a.date === b.date) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return a.date < b.date ? 1 : -1;
    });
    if (!query) return sorted;
    return sorted.filter((session) =>
      session.exercises.some((exercise) => exercise.name.toLowerCase().includes(query)) ||
      (session.title ?? "").toLowerCase().includes(query)
    );
  }, [search, workouts]);

  const exerciseSummary = useMemo(() => {
    const summary = new Map<
      string,
      {
        totalSets: number;
        totalReps: number;
        totalVolume: number;
        lastPerformed: string;
      }
    >();

    workouts.forEach((session) => {
      session.exercises.forEach((exercise) => {
        const key = exercise.name.trim() || "Unnamed Exercise";
        const record = summary.get(key) ?? {
          totalSets: 0,
          totalReps: 0,
          totalVolume: 0,
          lastPerformed: session.date,
        };

        const sets = exercise.sets ?? [];
        const newSets = record.totalSets + sets.length;
        const newReps =
          record.totalReps +
          sets.reduce((acc, set) => acc + (Number.isFinite(set.reps) ? set.reps : 0), 0);
        const newVolume =
          record.totalVolume +
          sets.reduce((acc, set) => acc + (set.weight ?? 0) * set.reps, 0);

        const lastPerformed = record.lastPerformed > session.date ? record.lastPerformed : session.date;

        summary.set(key, {
          totalSets: newSets,
          totalReps: newReps,
          totalVolume: newVolume,
          lastPerformed,
        });
      });
    });

    return Array.from(summary.entries()).sort((a, b) => b[1].lastPerformed.localeCompare(a[1].lastPerformed));
  }, [workouts]);

  const resetForm = () => {
    setTitle("");
    setSessionNotes("");
    setExercises([newExerciseDraft()]);
    setDate(todayISO);
  };

  const handleAddWorkout = () => {
    const preparedExercises = exercises
      .map((exercise) => {
        const cleanName = exercise.name.trim();
        const cleanSets = exercise.sets
          .map((set) => {
            const repsValue = parseInt(set.reps, 10);
            const weightValue = set.weight.trim() === "" ? undefined : parseFloat(set.weight);
            return {
              id: set.id,
              reps: repsValue,
              weight: Number.isNaN(weightValue) ? undefined : weightValue,
            } satisfies WorkoutSet;
          })
          .filter((set) => !Number.isNaN(set.reps) && set.reps > 0);

        if (!cleanName || cleanSets.length === 0) {
          return null;
        }

        return {
          id: exercise.id,
          name: cleanName,
          notes: exercise.notes.trim() || undefined,
          sets: cleanSets,
        } satisfies ExerciseEntry;
      })
      .filter(Boolean) as ExerciseEntry[];

    if (preparedExercises.length === 0) {
      setError("Add at least one exercise with a valid set before saving.");
      return;
    }

    const newWorkout: WorkoutSession = {
      id: createId(),
      date,
      title: title.trim() || undefined,
      notes: sessionNotes.trim() || undefined,
      exercises: preparedExercises,
      createdAt: new Date().toISOString(),
    };

    setWorkouts((prev) => [...prev, newWorkout]);
    resetForm();
    setFeedback("Workout saved");
  };

  const updateExercise = (exerciseId: string, updater: (exercise: ExerciseDraft) => ExerciseDraft) => {
    setExercises((prev) => prev.map((exercise) => (exercise.id === exerciseId ? updater(exercise) : exercise)));
  };

  const handleExerciseNameChange = (exerciseId: string, value: string) => {
    updateExercise(exerciseId, (exercise) => ({ ...exercise, name: value }));
  };

  const handleExerciseNotesChange = (exerciseId: string, value: string) => {
    updateExercise(exerciseId, (exercise) => ({ ...exercise, notes: value }));
  };

  const handleSetChange = (exerciseId: string, setId: string, field: "reps" | "weight", value: string) => {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === setId ? { ...set, [field]: value } : set)),
    }));
  };

  const addSetToExercise = (exerciseId: string) => {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: [
        ...exercise.sets,
        {
          id: createId(),
          reps: "",
          weight: "",
        },
      ],
    }));
  };

  const removeSetFromExercise = (exerciseId: string, setId: string) => {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.length <= 1 ? exercise.sets : exercise.sets.filter((set) => set.id !== setId),
    }));
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, newExerciseDraft()]);
  };

  const removeExercise = (exerciseId: string) => {
    setExercises((prev) => (prev.length <= 1 ? prev : prev.filter((exercise) => exercise.id !== exerciseId)));
  };

  const deleteWorkout = (workoutId: string) => {
    setWorkouts((prev) => prev.filter((workout) => workout.id !== workoutId));
  };

  const duplicateWorkout = (workoutId: string) => {
    const source = workouts.find((workout) => workout.id === workoutId);
    if (!source) return;

    setDate(source.date);
    setTitle(source.title ?? "");
    setSessionNotes(source.notes ?? "");
    setExercises(
      source.exercises.map((exercise) => ({
        id: createId(),
        name: exercise.name,
        notes: exercise.notes ?? "",
        sets: exercise.sets.map((set) => ({
          id: createId(),
          reps: String(set.reps),
          weight: set.weight != null ? String(set.weight) : "",
        })),
      }))
    );
    setFeedback("Session loaded into the editor");
  };

  const renderVolume = (sets: WorkoutSet[]) => {
    const total = sets.reduce((acc, set) => acc + (set.weight ?? 0) * set.reps, 0);
    if (!total) return "—";
    return `${total.toLocaleString()} kg`;
  };

  const formatDate = (iso: string) => {
    try {
      const dateObject = new Date(`${iso}T00:00:00`);
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(dateObject);
    } catch (error) {
      console.warn("Unable to format date", error);
      return iso;
    }
  };

  const totalSets = workouts.reduce(
    (acc, workout) => acc + workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    0
  );
  const totalVolume = workouts.reduce(
    (acc, workout) =>
      acc +
      workout.exercises.reduce(
        (exerciseSum, exercise) =>
          exerciseSum + exercise.sets.reduce((setSum, set) => setSum + (set.weight ?? 0) * set.reps, 0),
        0
      ),
    0
  );

  return (
    <div className="min-h-screen w-full bg-slate-950/95 pb-20 text-slate-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-12 md:flex-row md:gap-8">
        <section className="w-full rounded-2xl border border-slate-800/70 bg-slate-900/70 p-6 shadow-lg backdrop-blur md:max-w-md">
          <header className="mb-6 space-y-2">
            <h1 className="text-2xl font-semibold text-white">Rep &amp; Set Tracker</h1>
            <p className="text-sm text-slate-300">
              Log your strength sessions, record every set, and keep an eye on training volume over time.
            </p>
          </header>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-200">Session date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-200">Session focus (optional)</span>
              <input
                type="text"
                value={title}
                placeholder="Upper body strength"
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-200">Session notes</span>
              <textarea
                value={sessionNotes}
                placeholder="Warm-up details, how you felt..."
                onChange={(event) => setSessionNotes(event.target.value)}
                rows={3}
                className="resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>
          </div>

          <div className="mt-6 space-y-5">
            {exercises.map((exercise, exerciseIndex) => (
              <div key={exercise.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={exercise.name}
                      placeholder={`Exercise ${exerciseIndex + 1}`}
                      onChange={(event) => handleExerciseNameChange(exercise.id, event.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <textarea
                      value={exercise.notes}
                      placeholder="Notes (e.g. tempo, cues)"
                      onChange={(event) => handleExerciseNotesChange(exercise.id, event.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(exercise.id)}
                    className="rounded-lg border border-transparent bg-slate-800/80 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-300 transition hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={exercises.length <= 1}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {exercise.sets.map((set) => (
                    <div key={set.id} className="grid grid-cols-[repeat(12,_1fr)] items-center gap-3">
                      <div className="col-span-5">
                        <label className="flex flex-col text-xs uppercase tracking-wide text-slate-400">
                          Reps
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={set.reps}
                            onChange={(event) => handleSetChange(exercise.id, set.id, "reps", event.target.value)}
                            className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </label>
                      </div>
                      <div className="col-span-5">
                        <label className="flex flex-col text-xs uppercase tracking-wide text-slate-400">
                          Weight (kg)
                          <input
                            type="number"
                            min={0}
                            inputMode="decimal"
                            value={set.weight}
                            onChange={(event) => handleSetChange(exercise.id, set.id, "weight", event.target.value)}
                            className="mt-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </label>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeSetFromExercise(exercise.id, set.id)}
                          className="rounded-lg border border-transparent bg-slate-800/80 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-300 transition hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={exercise.sets.length <= 1}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSetToExercise(exercise.id)}
                    className="w-full rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20"
                  >
                    + Add set
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={addExercise}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800/60"
            >
              + Add exercise
            </button>
            <button
              type="button"
              onClick={handleAddWorkout}
              className="w-full rounded-lg bg-indigo-500 px-3 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-400"
            >
              Save workout
            </button>
          </div>

          {(feedback || error) && (
            <p
              className={`mt-3 text-center text-sm font-medium ${
                error ? "text-red-300" : "text-emerald-300"
              }`}
            >
              {error ?? feedback}
            </p>
          )}
        </section>

        <section className="flex-1 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total workouts</p>
              <p className="mt-3 text-2xl font-semibold text-white">{workouts.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Sets logged</p>
              <p className="mt-3 text-2xl font-semibold text-white">{totalSets}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total volume</p>
              <p className="mt-3 text-2xl font-semibold text-white">{totalVolume.toLocaleString()} kg</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Workout log</h2>
                <p className="text-sm text-slate-400">
                  Search by exercise name to surface past sessions instantly.
                </p>
              </div>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search exercises..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 md:w-64"
              />
            </header>

            {filteredWorkouts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                No workouts logged yet. Start by saving your first session.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredWorkouts.map((workout) => (
                  <article key={workout.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
                          {formatDate(workout.date)}
                        </p>
                        {workout.title && (
                          <h3 className="text-lg font-semibold text-white">{workout.title}</h3>
                        )}
                        {workout.notes && (
                          <p className="text-sm text-slate-300">{workout.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => duplicateWorkout(workout.id)}
                          className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-indigo-400 hover:text-indigo-200"
                        >
                          Load into editor
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWorkout(workout.id)}
                          className="rounded-lg border border-transparent bg-red-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-200 transition hover:bg-red-500/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {workout.exercises.map((exercise) => (
                        <div key={exercise.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <h4 className="text-base font-semibold text-white">{exercise.name}</h4>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              Volume: {renderVolume(exercise.sets)}
                            </p>
                          </div>
                          {exercise.notes && (
                            <p className="text-sm text-slate-300">{exercise.notes}</p>
                          )}
                          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
                            <table className="min-w-full divide-y divide-slate-800 text-sm">
                              <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
                                <tr>
                                  <th className="px-3 py-2 text-left">Set</th>
                                  <th className="px-3 py-2 text-left">Reps</th>
                                  <th className="px-3 py-2 text-left">Weight</th>
                                  <th className="px-3 py-2 text-left">Volume</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                {exercise.sets.map((set, index) => (
                                  <tr key={set.id}>
                                    <td className="px-3 py-2 text-slate-300">Set {index + 1}</td>
                                    <td className="px-3 py-2 text-slate-200">{set.reps}</td>
                                    <td className="px-3 py-2 text-slate-200">{set.weight ?? "—"}</td>
                                    <td className="px-3 py-2 text-slate-200">{(set.weight ?? 0) * set.reps}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-xl font-semibold text-white">Exercise insights</h2>
            {exerciseSummary.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Insights will appear after you log workouts.</p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {exerciseSummary.map(([name, stats]) => (
                  <div key={name} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <h3 className="text-base font-semibold text-white">{name}</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-300">
                      <p>
                        Sets logged: <span className="font-semibold text-slate-100">{stats.totalSets}</span>
                      </p>
                      <p>
                        Total reps: <span className="font-semibold text-slate-100">{stats.totalReps}</span>
                      </p>
                      <p>
                        Training volume: <span className="font-semibold text-slate-100">{stats.totalVolume.toLocaleString()} kg</span>
                      </p>
                      <p>
                        Last performed: <span className="font-semibold text-slate-100">{formatDate(stats.lastPerformed)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
