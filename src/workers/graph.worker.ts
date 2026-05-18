export interface LayoutWorkerData {
  nodes: any[];
  edges: any[];
}

self.onmessage = (e: MessageEvent<LayoutWorkerData>) => {
  const { nodes, edges } = e.data;
  
  if (nodes.length === 0) {
    self.postMessage({ nodes, edges });
    return;
  }

  const orchestratorIndex = nodes.findIndex((n: any) => n.id.toLowerCase() === 'orchestrator' || n.id.toLowerCase() === 'main terminal');
  const mainNodeIndex = orchestratorIndex >= 0 ? orchestratorIndex : 0;

  const mainNode = nodes[mainNodeIndex];
  const otherNodes = nodes.filter((_, i) => i !== mainNodeIndex);

  // Simplified layout since we don't have window.innerWidth in worker
  const centerX = 800 / 2; // Assuming a default canvas width
  const topY = 80;
  const bottomY = 320;

  mainNode.position = { x: centerX - 110, y: topY };

  const spacingX = 280;
  const totalWidth = (otherNodes.length - 1) * spacingX;
  const startX = centerX - (totalWidth / 2) - 110;

  otherNodes.forEach((node, index) => {
    node.position = {
      x: startX + (index * spacingX),
      y: bottomY + (index % 2 === 0 ? 0 : 60),
    };
  });

  self.postMessage({ nodes: [mainNode, ...otherNodes], edges });
};
