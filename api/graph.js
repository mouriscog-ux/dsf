const LIBERDADE_NODES = [
  { id: 'N1', name: 'Rua Galvão Bueno (Norte)', x: 60, y: 90, type: 'normal' },
  { id: 'N2', name: 'Cruzamento Galvão x Estudantes', x: 210, y: 95, type: 'normal' },
  { id: 'N3', name: 'Saída Metrô Liberdade', x: 340, y: 70, type: 'exit' },
  { id: 'N4', name: 'Viaduto Cidade de Osaka', x: 140, y: 60, type: 'blocked' },
  { id: 'N5', name: 'Rua dos Estudantes (Oeste)', x: 90, y: 260, type: 'normal' },
  { id: 'N6', name: 'Cruzamento Estudantes x Américo', x: 200, y: 200, type: 'normal' },
  { id: 'N7', name: 'Saída Praça da Liberdade', x: 300, y: 180, type: 'exit' },
  { id: 'N8', name: 'Rua Glória (Sul)', x: 160, y: 230, type: 'normal' },
  { id: 'N9', name: 'Rua Américo de Campos', x: 270, y: 270, type: 'normal' },
  { id: 'N10', name: 'Saída Avenida Liberdade', x: 420, y: 130, type: 'exit' },
  { id: 'N11', name: 'Rua Conselheiro Furtado', x: 380, y: 230, type: 'normal' },
  { id: 'N12', name: 'Rua São Joaquim', x: 110, y: 340, type: 'normal' }
];

const LIBERDADE_EDGES = [
  { from: 'N1', to: 'N4', weight: 80, street: 'R. Galvão Bueno' },
  { from: 'N4', to: 'N2', weight: 75, street: 'R. Galvão Bueno' },
  { from: 'N2', to: 'N3', weight: 130, street: 'Praça da Liberdade' },
  { from: 'N1', to: 'N5', weight: 170, street: 'R. Tomás de Lima' },
  { from: 'N5', to: 'N8', weight: 75, street: 'R. dos Estudantes' },
  { from: 'N8', to: 'N6', weight: 50, street: 'R. dos Estudantes' },
  { from: 'N6', to: 'N7', weight: 100, street: 'R. Américo de Campos' },
  { from: 'N2', to: 'N6', weight: 105, street: 'R. Galvão Bueno' },
  { from: 'N6', to: 'N9', weight: 90, street: 'R. Américo de Campos' },
  { from: 'N9', to: 'N7', weight: 95, street: 'R. da Glória' },
  { from: 'N3', to: 'N10', weight: 100, street: 'Av. Liberdade' },
  { from: 'N7', to: 'N10', weight: 130, street: 'Av. Liberdade' },
  { from: 'N7', to: 'N11', weight: 95, street: 'R. Cons. Furtado' },
  { from: 'N5', to: 'N12', weight: 85, street: 'R. São Joaquim' },
  { from: 'N8', to: 'N12', weight: 120, street: 'R. São Joaquim' }
];

module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ nodes: LIBERDADE_NODES, edges: LIBERDADE_EDGES }));
};
