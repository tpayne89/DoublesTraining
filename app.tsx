import "./styles.css";
import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const doubles = Array.from({ length: 20 }, (_, i) => i + 1);

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [throws, setThrows] = useState([]); // submitted throws only
  const [pendingThrows, setPendingThrows] = useState([]);
  const [submittedRounds, setSubmittedRounds] = useState([]);

  const currentDouble = doubles[currentIndex];

  // Ref to disable auto-submit temporarily after undo
  const ignoreAutoSubmitRef = useRef(false);

  // Auto-submit when 3 throws entered (but not if undo just happened)
  useEffect(() => {
    if (pendingThrows.length === 3) {
      if (ignoreAutoSubmitRef.current) {
        ignoreAutoSubmitRef.current = false;
        return;
      }
      submitThrows();
    }
  }, [pendingThrows]);

  const logThrow = (result) => {
    if (pendingThrows.length >= 3) return;

    const newThrow = { result, double: currentDouble };
    setPendingThrows([...pendingThrows, newThrow]);

    if (result === "hit" && currentIndex < doubles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const undo = () => {
    if (pendingThrows.length > 0) {
      const lastThrow = pendingThrows[pendingThrows.length - 1];

      setPendingThrows(pendingThrows.slice(0, -1));

      if (lastThrow.result === "hit" && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }

      ignoreAutoSubmitRef.current = true;
    } else if (submittedRounds.length > 0) {
      const lastRound = submittedRounds[submittedRounds.length - 1];

      setSubmittedRounds(submittedRounds.slice(0, -1));

      setThrows(throws.slice(0, -lastRound.length));
      setPendingThrows(lastRound);

      const hitsInLastRound = lastRound.filter(
        (t) => t.result === "hit"
      ).length;
      setCurrentIndex((prev) => Math.max(0, prev - hitsInLastRound));

      ignoreAutoSubmitRef.current = true;
    }
  };

  const submitThrows = () => {
    if (pendingThrows.length === 0) {
      const misses = [
        { result: "miss", double: currentDouble },
        { result: "miss", double: currentDouble },
        { result: "miss", double: currentDouble },
      ];
      setThrows([...throws, ...misses]);
      setSubmittedRounds([...submittedRounds, misses]);
    } else {
      setThrows([...throws, ...pendingThrows]);
      setSubmittedRounds([...submittedRounds, pendingThrows]);
    }
    setPendingThrows([]);
  };

  const allThrows = [...throws, ...pendingThrows];

  const hits = allThrows.filter((t) => t.result === "hit").length;
  const misses = allThrows.filter((t) => t.result === "miss").length;
  const total = allThrows.length;
  const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : "-";

  const statsByDouble = doubles.map((double) => {
    const throwsForDouble = allThrows.filter((t) => t.double === double);
    const hits = throwsForDouble.filter((t) => t.result === "hit").length;
    const attempts = throwsForDouble.length;
    const rate = attempts > 0 ? ((hits / attempts) * 100).toFixed(1) : "-";
    return { double, attempts, rate };
  });

  const getHitRateColor = (rateStr) => {
    if (rateStr === "-") return "#ccc";
    const rate = parseFloat(rateStr);

    if (rate >= 10) {
      // Dark green for 10% and above (maybe slight gradient from 10 to 100)
      // Let's do a gradient from a medium to darker green:
      const greenIntensity = Math.min(
        100,
        Math.round(50 + ((rate - 10) / 90) * 50)
      );
      return `rgb(0,${greenIntensity + 100},0)`; // range roughly from rgb(0,150,0) to rgb(0,200,0)
    } else if (rate >= 5) {
      // Orange gradient from 5 to 10%
      const ratio = (rate - 5) / 5;
      const r = 255;
      const g = Math.round(120 + ratio * 80); // from 120 to 200 (darker to lighter orange)
      const b = 0;
      return `rgb(${r},${g},${b})`;
    } else if (rate >= 0) {
      // Red gradient from 0 to 5%
      const ratio = rate / 5;
      const r = Math.round(150 + ratio * 105); // from 150 to 255 (dark to bright red)
      return `rgb(${r},0,0)`;
    } else {
      // For any negative or unexpected input, default gray
      return "#ccc";
    }
  };

  const printResults = () => {
    const doc = new jsPDF();

    const dateStr = new Date().toLocaleString();

    // Title
    doc.setFontSize(18);
    doc.text("Darts Doubles Trainer Results", 14, 20);

    doc.setFontSize(12);
    doc.text(`Date: ${dateStr}`, 14, 30);

    // Prepare the stats table data
    const statsHeaders = [["Double", "Attempts", "Hit Rate"]];
    const statsData = statsByDouble.map(({ double, attempts, rate }) => [
      `D${double}`,
      attempts.toString(),
      `${rate}%`,
    ]);

    // Add stats table
    autoTable(doc, {
      startY: 40,
      head: statsHeaders,
      body: statsData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [230, 230, 230] },
    });

    // Prepare throw log table data
    const logHeaders = [["Throw 1", "Throw 2", "Throw 3"]];
    const logData = submittedRounds.map((round) =>
      round.map((t) =>
        t.result === "hit" ? `Hit D${t.double}` : `Miss D${t.double}`
      )
    );

    // Add some space before throw log table
    const finalY = doc.lastAutoTable.finalY || 60;

    // Add throw log table
    autoTable(doc, {
      startY: finalY + 10,
      head: logHeaders,
      body: logData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [230, 230, 230] },
    });

    // Open the PDF in a new tab
    doc.save("darts-results.pdf");
  };

  return (
    <div className="app-container">
      <h1 className="title">Darts Doubles Trainer</h1>
      <h2 className="subtitle">
        Target: <strong>D{currentDouble}</strong>
      </h2>

      <div className="stats-grid">
        <div>
          <strong>Misses:</strong> {misses}
        </div>
        <div>
          <strong>Hits:</strong> {hits}
        </div>
        <div>
          <strong>Darts Thrown:</strong> {total}
        </div>
        <div>
          <strong>Hit Rate:</strong> {hitRate}%
        </div>
      </div>

      <div className="pending-throws">
        {[0, 1, 2].map((i) => {
          const t = pendingThrows[i];
          const bg = t ? (t.result === "hit" ? "green" : "red") : "gray";
          const text = t ? (t.result === "hit" ? "Hit" : "Miss") : "-";
          return (
            <div key={i} className={`throw-box ${bg}`}>
              {text}
            </div>
          );
        })}
      </div>

      <div className="button-group">
        <button
          onClick={() => logThrow("miss")}
          disabled={pendingThrows.length >= 3}
        >
          Miss
        </button>
        <button
          onClick={() => logThrow("hit")}
          disabled={pendingThrows.length >= 3}
        >
          D{currentDouble}
        </button>
        <button onClick={submitThrows}>Submit</button>
      </div>

      <div
        className="undo-group"
        style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}
      >
        <button
          onClick={undo}
          disabled={pendingThrows.length === 0 && submittedRounds.length === 0}
        >
          Undo
        </button>
      </div>

      <button
        onClick={printResults}
        className="print-button"
        style={{ margin: "1rem auto", display: "block" }}
      >
        Print Results
      </button>

      <table className="stats-table">
        <thead>
          <tr>
            <th>Double</th>
            <th>Attempts</th>
            <th>Hit Rate</th>
          </tr>
        </thead>
        <tbody>
          {statsByDouble.map(({ double, attempts, rate }) => (
            <tr key={double}>
              <td>D{double}</td>
              <td>{attempts}</td>
              <td style={{ color: getHitRateColor(rate), fontWeight: "bold" }}>
                {rate}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="log-table">
        <thead>
          <tr>
            <th>Throw 1</th>
            <th>Throw 2</th>
            <th>Throw 3</th>
          </tr>
        </thead>
        <tbody>
          {submittedRounds.map((round, index) => (
            <tr key={index}>
              {round.map((t, i) => (
                <td
                  key={i}
                  className={t.result === "hit" ? "hit-text" : "miss-text"}
                >
                  {t.result === "hit" ? "Hit" : "Miss"} D{t.double}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
