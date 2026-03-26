import { useEffect, useRef } from "react";
import * as d3 from "d3";

/**
 * Simple Mobile-Friendly Treemap for Budget Committees
 * Shows only expense categories with green-to-red color scale
 * Displays committee name and amount in mnkr
 */
export default function SimpleTreemap({ categories, taxBaseInfo, onCategoryClick }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !categories || categories.length === 0) return;

    // Clear previous content
    d3.select(containerRef.current).selectAll("*").remove();

    // Get container dimensions (mobile-responsive)
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.min(width * 0.75, 600); // 4:3 aspect ratio, max 600px height

    // Create SVG
    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("font-family", "sans-serif");

    // Helper function to simplify names
    const simplifyName = (name) => {
      return name
        .replace(/nämnden?$/i, "") // Remove "nämnden" or "nämnd" at end
        .replace(/^Generella statsbidrag och utjämning$/i, "Statsbidrag")
        .replace(/^Finansiella intäkter$/i, "Intäkter")
        .trim();
    };

    // Prepare data for treemap
    // Filter out categories with zero or negative values to prevent layout issues
    const data = {
      name: "Budget",
      children: categories
        .filter((cat) => {
          const value = cat.amount || cat.defaultAmount || 0;
          return value > 0;
        })
        .map((cat) => ({
          name: simplifyName(cat.name),
          value: Math.max(cat.amount || cat.defaultAmount || 0, 100000), // Minimum 0.1 mnkr
          color: cat.color,
          id: cat.id,
        })),
    };

    // If no valid categories, show placeholder
    if (data.children.length === 0) {
      return;
    }

    // Sort items: smallest first (will be placed at top-right)
    const sortedData = {
      name: "Budget",
      children: [...data.children].sort((a, b) => a.value - b.value),
    };

    // Create hierarchy
    const root = d3
      .hierarchy(sortedData)
      .sum((d) => d.value)
      .sort((a, b) => a.value - b.value);

    // Use D3's squarify treemap algorithm for proper area preservation
    // This ensures total area = total budget value
    const treemap = d3
      .treemap()
      .size([width, height])
      .padding(2)
      .tile(d3.treemapSquarify.ratio(1.5)); // Slightly wider rectangles for text readability

    treemap(root);

    const leaves = root.leaves();
    const totalValue = root.value;

    // Draw rectangles
    const cells = svg
      .selectAll("g")
      .data(leaves)
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
      .on("click", function(_event, d) {
        if (onCategoryClick) {
          onCategoryClick(d.data.id);
        }
      });

    // Add colored rectangles
    cells
      .append("rect")
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (d) => d.data.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("class", "treemap-cell")
      .attr("data-category-id", (d) => d.data.id)
      .style("cursor", onCategoryClick ? "pointer" : "default");

    // Add text labels
    cells.each(function (d) {
      const cell = d3.select(this);
      const rectWidth = d.x1 - d.x0;
      const rectHeight = d.y1 - d.y0;
      const centerX = rectWidth / 2;

      // Determine if this is a small item
      const proportion = d.value / totalValue;
      const isSmall = proportion < 0.05;

      // Committee name (wrapped if needed)
      const nameLines = wrapText(d.data.name, rectWidth - 8);

      // Font size: 8px minimum for small items, scales up for larger items
      const fontSize = isSmall
        ? Math.max(8, Math.min(rectHeight / 2.5, 10))
        : Math.max(12, Math.min(rectWidth / 8, rectHeight / 6, 24));

      // For large items: place text near top (20px from top)
      // For small items: center vertically
      const textTopOffset = isSmall
        ? rectHeight / 2
        : Math.min(20 + fontSize, rectHeight / 3);

      nameLines.forEach((line, i) => {
        cell
          .append("text")
          .attr("x", centerX)
          .attr("y", textTopOffset + i * fontSize)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "hanging")
          .attr("fill", "#1e293b")
          .attr("font-size", `${fontSize}px`)
          .attr("font-weight", "bold")
          .text(line);
      });

      // Amount in mnkr - smaller for small items
      const amountText = `${(d.value / 1000000).toFixed(1)} mnkr`;
      const amountFontSize = isSmall
        ? Math.max(7, Math.min(rectHeight / 3, 9))
        : Math.max(10, Math.min(rectWidth / 10, rectHeight / 8, 18));

      cell
        .append("text")
        .attr("x", centerX)
        .attr("y", textTopOffset + nameLines.length * fontSize + 4)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .attr("fill", "#475569")
        .attr("font-size", `${amountFontSize}px`)
        .text(amountText);
    });

    // Responsive resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = container.clientWidth;
      const newHeight = Math.min(newWidth * 0.75, 600);

      svg.attr("width", newWidth).attr("height", newHeight);
      svg.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);

      // Recalculate treemap layout with new dimensions
      const newTreemap = d3
        .treemap()
        .size([newWidth, newHeight])
        .padding(2)
        .tile(d3.treemapSquarify.ratio(1.5));

      newTreemap(root);

      // Update positions and sizes
      cells.attr("transform", (d) => `translate(${d.x0},${d.y0})`);

      cells
        .select("rect")
        .attr("width", (d) => d.x1 - d.x0)
        .attr("height", (d) => d.y1 - d.y0);

      // Update text positions
      cells.each(function (d) {
        const cell = d3.select(this);
        const rectWidth = d.x1 - d.x0;
        const rectHeight = d.y1 - d.y0;
        const centerX = rectWidth / 2;

        cell.selectAll("text").remove();

        const proportion = d.value / totalValue;
        const isSmall = proportion < 0.05;

        const nameLines = wrapText(d.data.name, rectWidth - 10);
        const fontSize = isSmall
          ? Math.max(8, Math.min(rectHeight / 2.5, 10))
          : Math.max(12, Math.min(rectWidth / 8, rectHeight / 6, 24));

        // For large items: place text near top (20px from top)
        // For small items: center vertically
        const textTopOffset = isSmall
          ? rectHeight / 2
          : Math.min(20 + fontSize, rectHeight / 3);

        nameLines.forEach((line, i) => {
          cell
            .append("text")
            .attr("x", centerX)
            .attr("y", textTopOffset + i * fontSize)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("fill", "#1e293b")
            .attr("font-size", `${fontSize}px`)
            .attr("font-weight", "bold")
            .text(line);
        });

        const amountText = `${(d.value / 1000000).toFixed(1)} mnkr`;
        const amountFontSize = isSmall
          ? Math.max(7, Math.min(rectHeight / 3, 9))
          : Math.max(10, Math.min(rectWidth / 10, rectHeight / 8, 18));

        cell
          .append("text")
          .attr("x", centerX)
          .attr("y", textTopOffset + nameLines.length * fontSize + 4)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "hanging")
          .attr("fill", "#475569")
          .attr("font-size", `${amountFontSize}px`)
          .text(amountText);
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, taxBaseInfo, onCategoryClick]);

  // Helper function to wrap text with hyphenation support
  function wrapText(text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = words[0] || "";

    // Average character width estimate (adjusted for larger font sizes)
    const avgCharWidth = 10;
    const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;

      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        // If current word is very long, try to hyphenate it
        if (word.length > maxCharsPerLine && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = hyphenateWord(word, maxCharsPerLine);
        } else if (word.length > maxCharsPerLine) {
          currentLine = hyphenateWord(word, maxCharsPerLine);
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.slice(0, 3); // Max 3 lines
  }

  // Helper function to hyphenate long words
  function hyphenateWord(word, maxChars) {
    if (word.length <= maxChars) return word;

    // Simple hyphenation: break at syllable-like positions
    // For Swedish, common break points
    const breakPoints = [
      "ning",
      "tion",
      "sion",
      "ling",
      "het",
      "ska",
      "ligt",
      "igt",
      "are",
      "or",
    ];

    for (const breakPoint of breakPoints) {
      const index = word.indexOf(breakPoint);
      if (index > 0 && index < maxChars - 1) {
        return word.substring(0, index + breakPoint.length) + "-";
      }
    }

    // Fallback: break at maxChars - 1 and add hyphen
    return word.substring(0, maxChars - 1) + "-";
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="w-full bg-gray-50 rounded-lg border border-gray-200 shadow-sm"
      />
    </div>
  );
}
