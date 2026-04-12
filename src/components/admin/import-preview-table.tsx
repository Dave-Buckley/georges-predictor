'use client'

interface ImportPreviewRow {
  display_name: string
  starting_points: number
}

interface ImportPreviewError {
  line: number
  message: string
}

interface ImportPreviewTableProps {
  rows: ImportPreviewRow[]
  errors: ImportPreviewError[]
}

export function ImportPreviewTable({ rows, errors }: ImportPreviewTableProps) {
  const maxPoints = rows.length > 0 ? Math.max(...rows.map((r) => r.starting_points)) : 0

  return (
    <div className="space-y-3">
      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-700">
              {err.line > 0 ? (
                <span className="font-medium">Line {err.line}: </span>
              ) : null}
              {err.message}
            </p>
          ))}
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-12">#</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Name</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => {
                const isLeader = row.starting_points === maxPoints && maxPoints > 0
                return (
                  <tr key={i} className={isLeader ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-900 font-medium">
                      {row.display_name}
                      {isLeader && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">leader</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 font-mono">
                      {row.starting_points}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-1.5">
            {rows.length} member{rows.length !== 1 ? 's' : ''} ready to import
          </p>
        </div>
      )}
    </div>
  )
}
