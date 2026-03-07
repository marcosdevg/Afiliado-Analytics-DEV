'use client'

import { useState } from 'react';
import { PlusCircle, MinusCircle, ChevronDown } from 'lucide-react';
import type { CategoryNode } from '@/types';

const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function TableRow({ node, level }: { node: CategoryNode, level: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const indentStyle = { paddingLeft: `${level * 24}px` };

  // ==================================================================
  // MUDANÇA 2: Fundo de nível RESTAURADO
  // ==================================================================
  const levelBackgroundClass = () => {
    switch (level) {
      case 1:
        return 'bg-black/10';
      case 2:
        return 'bg-black/20';
      default:
        return '';
    }
  };

  const levelBorderClass = () => {
    switch (level) {
      case 1:
        return 'border-l-2 border-shopee-orange/30';
      case 2:
        return 'border-l-2 border-shopee-orange/60';
      default:
        return 'border-l-2 border-transparent';
    }
  };

  return (
    <>
      {/* A classe do fundo de nível foi adicionada de volta aqui 👇 */}
      <tr className={`border-b border-dark-border hover:bg-dark-bg/50 ${levelBackgroundClass()}`}>
        <td className={`p-3 text-sm text-text-secondary ${levelBorderClass()}`} style={indentStyle}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button onClick={() => setIsExpanded(!isExpanded)} className="text-shopee-orange transition-opacity hover:opacity-80">
                {isExpanded ? <MinusCircle size={16} /> : <PlusCircle size={16} />}
              </button>
            ) : (
              <span className="w-[20px] shrink-0"></span>
            )}
            <span>{node.name} <span className="text-text-secondary/60 text-xs">(L{level + 1})</span></span>
          </div>
        </td>
        <td className="p-3 text-sm text-text-primary font-semibold">{formatCurrency(node.totalCommission)}</td>
        <td className="p-3 text-sm text-text-secondary text-center">{node.totalOrders}</td>
      </tr>
      {isExpanded && hasChildren && (
        <>
          {node.children?.map(childNode => (
            <TableRow key={childNode.name} node={childNode} level={level + 1} />
          ))}
        </>
      )}
    </>
  );
}

export default function NicheExplorerTable({ data }: { data: CategoryNode[] }) {
  const [visibleCount, setVisibleCount] = useState(5);

  const handleViewMore = () => {
    setVisibleCount(prevCount => prevCount + 5);
  };
  
  const visibleData = data.slice(0, visibleCount);
  
  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
      <h3 className="text-lg font-semibold text-text-primary font-heading mb-4">Explorador de Nichos</h3>
      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full table-auto text-left">
          <thead className="bg-dark-bg">
            <tr>
              {/* ================================================================== */}
              {/* MUDANÇA 1: Títulos revertidos para a cor padrão (cinza claro) */}
              {/* ================================================================== */}
              <th className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider rounded-tl-lg">Categoria</th>
              <th className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider">Comissão Líquida Total</th>
              <th className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-center rounded-tr-lg">Nº de Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {visibleData.map(node => (
              <TableRow key={node.name} node={node} level={0} />
            ))}
          </tbody>
          <tfoot>
            {visibleCount < data.length && (
              <tr>
                <td colSpan={3} className="text-center p-4">
                  <button
                    onClick={handleViewMore}
                    className="w-full sm:w-auto px-5 py-2 text-sm font-semibold text-text-tertiary bg-dark-bg/50 rounded-md hover:bg-dark-bg transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    <ChevronDown size={16} />
                    Carregar mais
                  </button>
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}