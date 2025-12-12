import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, NodeData, FileType } from '../types';
import { Maximize } from 'lucide-react';

interface GraphVisualizerProps {
  data: GraphData;
  onNodeSelect: (node: NodeData) => void;
  selectedNodeId?: string;
  focusTrigger?: number; 
}

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
  
  const nodesRef = useRef<SimulationNode[]>([]);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("cursor", "grab");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });
    
    zoomRef.current = zoom;
    svg.call(zoom);

    // Initial Zoom - Increased to 2.0
    svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(2.0).translate(-width/2, -height/2));

    const nodes: SimulationNode[] = data.nodes.map(d => ({ ...d }));
    const links: SimulationLink[] = data.links.map(d => ({ ...d }));
    nodesRef.current = nodes;

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links).id(d => d.id).distance(60)) // Reduced from 120 to compact graph
      .force("charge", d3.forceManyBody().strength(-200)) // Reduced from -500 to reduce spread
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(32)); // Adjusted collision

    simulationRef.current = simulation;

    // Define Glow Filter
    const defs = svg.append("defs");
    const filter = defs.append("filter")
      .attr("id", "glow");
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "2.5")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Links
    const link = g.append("g")
      .attr("stroke", "#ffffff")
      .attr("stroke-opacity", 0.1)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1);

    // Nodes
    const node = g.append("g")
      .selectAll("g") 
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag<SVGGElement, SimulationNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Circles
    node.append("circle")
      .attr("r", d => d.type === FileType.FOLDER ? 12 : 8) 
      .attr("fill", d => {
        if (d.type === FileType.SERVICE) return "#8b5cf6"; 
        if (d.type === FileType.FOLDER) return "#06b6d4";
        return "#ffffff"; 
      })
      .attr("fill-opacity", d => d.type === FileType.FILE ? 0.8 : 1)
      .style("filter", "url(#glow)") 
      .attr("stroke", d => d.id === selectedNodeId ? "#fff" : "none")
      .attr("stroke-width", 2);

    // Selection Ring (Animated)
    node.append("circle")
      .attr("r", d => d.type === FileType.FOLDER ? 20 : 14) 
      .attr("fill", "none")
      .attr("stroke", d => d.id === selectedNodeId ? "#3b82f6" : "transparent")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.5)
      .attr("class", "selection-ring");

    // Labels
    node.append("text")
      .text(d => d.name)
      .attr("x", 16) 
      .attr("y", 5)
      .attr("fill", "#a1a1aa")
      .attr("font-size", "12px")
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .style("opacity", 0.8);
    
    node.on("click", (event, d) => {
      event.stopPropagation();
      onNodeSelect(d);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimulationNode).x!)
        .attr("y1", d => (d.source as SimulationNode).y!)
        .attr("x2", d => (d.target as SimulationNode).x!)
        .attr("y2", d => (d.target as SimulationNode).y!);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: SimulationNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
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

  // Update selection visually
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    svg.selectAll(".selection-ring")
      .attr("stroke", (d: any) => d.id === selectedNodeId ? "#3b82f6" : "transparent");
      
    svg.selectAll("text")
      .attr("fill", (d: any) => d.id === selectedNodeId ? "#fff" : "#a1a1aa")
      .attr("font-weight", (d: any) => d.id === selectedNodeId ? "700" : "500")
      .style("opacity", (d: any) => d.id === selectedNodeId ? 1 : 0.8);

  }, [selectedNodeId]);

  // Focus Logic
  useEffect(() => {
    if (focusTrigger && selectedNodeId && svgRef.current && zoomRef.current && containerRef.current) {
      const node = nodesRef.current.find(n => n.id === selectedNodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const svg = d3.select(svgRef.current);
        
        svg.transition()
          .duration(1000)
          .ease(d3.easeCubicOut)
          .call(
            zoomRef.current.transform, 
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(2.5) 
              .translate(-node.x, -node.y)
          );
      }
    }
  }, [focusTrigger, selectedNodeId]);

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-full outline-none"></svg>
    </div>
  );
};

export default GraphVisualizer;