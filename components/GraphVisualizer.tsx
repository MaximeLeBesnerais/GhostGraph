import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { GraphData, NodeData, LinkData, FileType } from '../types';
import { Maximize } from 'lucide-react';

interface GraphVisualizerProps {
  data: GraphData;
  onNodeSelect: (node: NodeData) => void;
  selectedNodeId?: string;
  focusTrigger?: number; // Prop to trigger a manual focus
}

// Extend D3 types for simulation
interface SimulationNode extends d3.SimulationNodeDatum, NodeData {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}
interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  type: string;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data, onNodeSelect, selectedNodeId, focusTrigger }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  
  // Ref to store current nodes to look them up for zooming
  const nodesRef = useRef<SimulationNode[]>([]);

  // Initialize Graph
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("cursor", "grab");

    // Group for zoomable content
    const g = svg.append("g");
    gRef.current = g;

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });
    
    zoomRef.current = zoom;
    svg.call(zoom);

    // Process Data
    const nodes: SimulationNode[] = data.nodes.map(d => ({ ...d }));
    const links: SimulationLink[] = data.links.map(d => ({ ...d }));
    nodesRef.current = nodes;

    // Define Simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(35));

    simulationRef.current = simulation;

    // Arrow markers
    svg.append("defs").selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", String)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28) // Distance from node center
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#52525b");

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#3f3f46")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#end)");

    // Draw Nodes
    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g") // Use 'g' grouping for circle + text handling
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag<SVGGElement, SimulationNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Visuals
    node.append("circle")
      .attr("r", d => d.type === FileType.FOLDER ? 14 : 10)
      .attr("fill", d => {
        if (d.type === FileType.SERVICE) return "#8b5cf6"; 
        if (d.type === FileType.FOLDER) return "#3b82f6";
        return "#18181b"; 
      })
      .attr("stroke", d => {
        if (d.id === selectedNodeId) return "#3b82f6"; // Highlight selected in logic
        if (d.type === FileType.FILE) return "#a1a1aa";
        return "#fff";
      })
      .attr("stroke-width", d => d.id === selectedNodeId ? 3 : 1.5);

    // Node Labels
    node.append("text")
      .text(d => d.name)
      .attr("x", 18)
      .attr("y", 5)
      .attr("fill", "#e4e4e7")
      .attr("stroke", "none")
      .attr("font-size", "12px")
      .attr("font-family", "JetBrains Mono, monospace")
      .style("pointer-events", "none")
      .style("text-shadow", "2px 2px 4px #000");
    
    // Interaction
    node.on("click", (event, d) => {
      // Prevent the click from being interpreted as a drag that restarts simulation violently
      event.stopPropagation();
      onNodeSelect(d);
    });

    // Simulation Ticks
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimulationNode).x!)
        .attr("y1", d => (d.source as SimulationNode).y!)
        .attr("x2", d => (d.target as SimulationNode).x!)
        .attr("y2", d => (d.target as SimulationNode).y!);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: SimulationNode) {
      // Reduced alpha target to prevent violent shaking of the whole graph
      if (!event.active) simulation.alphaTarget(0.1).restart();
      d.fx = d.x;
      d.fy = d.y;
      svg.style("cursor", "grabbing");
    }

    function dragged(event: any, d: SimulationNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: SimulationNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      svg.style("cursor", "grab");
    }

    return () => {
      simulation.stop();
    };
  }, [data]);

  // Update selection highlight without rebuilding graph
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    svg.selectAll(".node circle")
      .attr("stroke", (d: any) => {
        if (d.id === selectedNodeId) return "#3b82f6";
        if (d.type === FileType.FILE) return "#a1a1aa";
        return "#fff";
      })
      .attr("stroke-width", (d: any) => d.id === selectedNodeId ? 3 : 1.5);
      
  }, [selectedNodeId]);

  // Handle Manual Focus Trigger
  useEffect(() => {
    if (focusTrigger && selectedNodeId && svgRef.current && zoomRef.current && containerRef.current) {
      const node = nodesRef.current.find(n => n.id === selectedNodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const svg = d3.select(svgRef.current);
        const currentTransform = d3.zoomTransform(svgRef.current);
        
        // Center the node but maintain current zoom level (or min 1)
        const scale = Math.max(currentTransform.k, 1); 
        
        svg.transition()
          .duration(750)
          .call(
            zoomRef.current.transform, 
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(scale)
              .translate(-node.x, -node.y)
          );
      }
    }
  }, [focusTrigger, selectedNodeId]);

  return (
    <div className="relative w-full h-full bg-ghost-900 overflow-hidden" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-full"></svg>
      
      {/* Overlay Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <div className="bg-ghost-800 border border-ghost-700 rounded-lg p-2 flex gap-2 shadow-xl">
           <div className="text-xs text-ghost-400 flex items-center px-2">
             Zoom: {Math.round(zoomLevel * 100)}%
           </div>
           <button 
            className="p-2 hover:bg-ghost-700 rounded text-ghost-300 hover:text-white transition" 
            title="Reset View"
            onClick={() => {
              if (svgRef.current && zoomRef.current) {
                 d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
              }
            }}
           >
             <Maximize size={18} />
           </button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-ghost-800/80 backdrop-blur border border-ghost-700 p-3 rounded-lg text-xs pointer-events-none select-none">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-neon-purple"></div>
          <span className="text-ghost-300">Service / Module</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-neon-blue"></div>
          <span className="text-ghost-300">Folder / Container</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border border-ghost-300 bg-ghost-900"></div>
          <span className="text-ghost-300">File</span>
        </div>
      </div>
    </div>
  );
};

export default GraphVisualizer;