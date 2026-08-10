/**
 * 获取多边形顶点坐标
 * @param {number} edges 边数
 * @param {number} radius 半径
 * @returns {Array<{x: number, y: number}>} 坐标数组
 */
export function getPolygonVertices(edges, radius) {
  const vertices = []
  const interiorAngle = (Math.PI * 2) / edges
  let rotationAdjustment = -Math.PI / 2
  if (edges % 2 === 0) rotationAdjustment += interiorAngle / 2
  for (let i = 0; i < edges; i++) {
    const rad = i * interiorAngle + rotationAdjustment
    vertices.push({ x: Math.cos(rad) * radius, y: Math.sin(rad) * radius })
  }
  return vertices
}
