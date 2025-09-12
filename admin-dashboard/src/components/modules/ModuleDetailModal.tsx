'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, RefreshCw, Download, Eye, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ModuleDetailModalProps {
  moduleName: string;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'browse' | 'search' | 'actions';
  manageOnly?: boolean;
}

interface DataItem {
  id: string | number;
  [key: string]: any;
}

interface ModuleConfig {
  title: string;
  description: string;
  endpoints: {
    list: string;
    search?: string;
    detail?: string;
  };
  columns: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'badge' | 'action';
    width?: string;
  }[];
  searchFields: string[];
  filters?: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
  }[];
}

const moduleConfigs: Record<string, ModuleConfig> = {
  quran: {
    title: 'Quran Management',
    description: 'Browse and manage Quran chapters, verses, and translations',
    endpoints: {
      list: '/api/v4/quran/chapters',
      search: '/api/v4/quran/search',
    },
    columns: [
      { key: 'id', label: 'ID', type: 'number', width: '80px' },
      { key: 'nameArabic', label: 'Arabic Name', type: 'text' },
      { key: 'nameSimple', label: 'English Name', type: 'text' },
      { key: 'versesCount', label: 'Verses', type: 'number', width: '100px' },
      { key: 'revelationPlace', label: 'Revelation', type: 'badge', width: '120px' },
    ],
    searchFields: ['nameSimple', 'nameArabic'],
    filters: [
      {
        key: 'revelationPlace',
        label: 'Revelation Place',
        options: [
          { value: 'makkah', label: 'Makkah' },
          { value: 'madinah', label: 'Madinah' },
        ],
      },
    ],
  },
  hadith: {
    title: 'Hadith Management',
    description: 'Browse and manage Hadith collections, books, and hadiths',
    endpoints: {
      list: '/api/v4/hadith/collections',
      search: '/api/v4/hadith/search',
    },
    columns: [
      { key: 'id', label: 'ID', type: 'number', width: '80px' },
      { key: 'name', label: 'Collection Name', type: 'text' },
      { key: 'totalAvailableHadith', label: 'Total Hadiths', type: 'number', width: '120px' },
      { key: 'totalAvailableBooks', label: 'Total Books', type: 'number', width: '120px' },
      { key: 'language', label: 'Language', type: 'badge', width: '100px' },
    ],
    searchFields: ['name'],
    filters: [
      {
        key: 'language',
        label: 'Language',
        options: [
          { value: 'en', label: 'English' },
          { value: 'bn', label: 'Bengali' },
        ],
      },
    ],
  },
  prayer: {
    title: 'Prayer Times Management',
    description: 'Browse and manage prayer times and locations',
    endpoints: {
      list: '/api/v1/prayer/timings',
    },
    columns: [
      { key: 'date', label: 'Date', type: 'date', width: '120px' },
      { key: 'Fajr', label: 'Fajr', type: 'text', width: '100px' },
      { key: 'Dhuhr', label: 'Dhuhr', type: 'text', width: '100px' },
      { key: 'Asr', label: 'Asr', type: 'text', width: '100px' },
      { key: 'Maghrib', label: 'Maghrib', type: 'text', width: '100px' },
      { key: 'Isha', label: 'Isha', type: 'text', width: '100px' },
    ],
    searchFields: ['date'],
  },
  finance: {
    title: 'Finance Management',
    description: 'Browse and manage gold prices and financial data',
    endpoints: {
      list: '/api/v4/finance/gold-prices/latest',
    },
    columns: [
      { key: 'id', label: 'ID', type: 'number', width: '80px' },
      { key: 'productName', label: 'Product', type: 'text' },
      { key: 'category', label: 'Category', type: 'badge', width: '120px' },
      { key: 'price', label: 'Price', type: 'number', width: '100px' },
      { key: 'unit', label: 'Unit', type: 'badge', width: '80px' },
      { key: 'fetchedAt', label: 'Updated', type: 'date', width: '120px' },
    ],
    searchFields: ['productName', 'category'],
    filters: [
      {
        key: 'category',
        label: 'Category',
        options: [
          { value: '22K', label: '22K' },
          { value: '21K', label: '21K' },
          { value: '18K', label: '18K' },
          { value: 'TRADITIONAL', label: 'Traditional' },
        ],
      },
      {
        key: 'unit',
        label: 'Unit',
        options: [
          { value: 'Gram', label: 'Gram' },
          { value: 'Vori', label: 'Vori' },
        ],
      },
    ],
  },
  audio: {
    title: 'Audio Management',
    description: 'Browse and manage audio files and recitations',
    endpoints: {
      list: '/api/v4/recitations',
    },
    columns: [
      { key: 'id', label: 'ID', type: 'number', width: '80px' },
      { key: 'name', label: 'Reciter Name', type: 'text' },
      { key: 'language', label: 'Language', type: 'badge', width: '100px' },
      { key: 'style', label: 'Style', type: 'text', width: '120px' },
      { key: 'format', label: 'Format', type: 'badge', width: '100px' },
    ],
    searchFields: ['name', 'style'],
    filters: [
      {
        key: 'language',
        label: 'Language',
        options: [
          { value: 'ar', label: 'Arabic' },
          { value: 'en', label: 'English' },
        ],
      },
    ],
  },
};

export function ModuleDetailModal({ moduleName, isOpen, onClose, initialTab, manageOnly }: ModuleDetailModalProps) {
  const [data, setData] = useState<DataItem[]>([]);
  const [filteredData, setFilteredData] = useState<DataItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState('browse');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedItem, setSelectedItem] = useState<DataItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const config = moduleConfigs[moduleName.toLowerCase()];
  
  // Fixed items per page for better UX
  const itemsPerPage = 20;

  useEffect(() => {
    if (isOpen && config) {
      setActiveTab(initialTab || 'browse');
      fetchData();
    } else if (!isOpen) {
      // Clean up state when dialog is closed
      setData([]);
      setFilteredData([]);
      setSearchTerm('');
      setSelectedFilters({});
      setCurrentPage(1);
      setTotalPages(1);
      setTotalCount(0);
    }
  }, [isOpen, moduleName, initialTab]);

  // Ensure tab updates immediately if caller changes the desired tab
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Refetch data when page/search/filters change
  useEffect(() => {
    if (isOpen && config) {
      fetchData();
    }
  }, [currentPage, searchTerm, selectedFilters]);

  // Cleanup effect to abort pending requests
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const fetchData = async () => {
    if (!config) return;

    // Cancel any existing request
    if (abortController) {
      abortController.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    setAbortController(controller);

    setIsLoading(true);
    try {
      // Use the proper API client instead of fetch
      const moduleKey = moduleName.toLowerCase();
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (searchTerm) params.search = searchTerm;
      Object.entries(selectedFilters).forEach(([k, v]) => {
        if (v && v !== 'all') params[k] = v;
      });

      const result: any = await apiClient.getContent(moduleKey, params);
      
      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      
      // Handle the response format from apiClient.getContent
      let items: DataItem[] = [];
      if (result.data && Array.isArray(result.data)) {
        items = result.data;
      } else if (result.data) {
        items = [result.data];
      }

      setData(items);
      setFilteredData(items);
      // total count from different possible shapes
      const totalFromApi =
        (result.pagination && (result.pagination.total || result.pagination.total_count)) ??
        (typeof result.total === 'number' ? result.total : undefined) ??
        (typeof result.count === 'number' ? result.count : undefined) ??
        (Array.isArray(items) ? items.length : 0);
      setTotalCount(totalFromApi);
      setTotalPages(Math.max(1, Math.ceil(Number(totalFromApi || 0) / itemsPerPage)));
    } catch (error) {
      // Don't log errors if request was aborted
      if (!controller.signal.aborted) {
        console.error('Failed to fetch data:', error);
        setData([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const applyFilters = () => {
    let filtered = [...data];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        config.searchFields.some(field =>
          item[field]?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply other filters
    Object.entries(selectedFilters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        filtered = filtered.filter(item =>
          item[key]?.toString().toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // When using server-side pagination, filtered contains the current page slice.
    setFilteredData(filtered);
  };

  const handleFilterChange = (key: string, value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Server-side pagination returns already paged rows
  const getCurrentRows = () => filteredData;

  const renderCell = (item: DataItem, column: ModuleConfig['columns'][0]) => {
    const value = item[column.key];
    
    switch (column.type) {
      case 'badge':
        return (
          <Badge variant="secondary" className="text-xs">
            {value || 'N/A'}
          </Badge>
        );
      case 'date':
        return value ? new Date(value).toLocaleDateString() : 'N/A';
      case 'number':
        return value?.toLocaleString() || '0';
      default:
        return value || 'N/A';
    }
  };

  const startCreate = () => {
    setSelectedItem(null);
    setFormData({});
    setIsCreating(true);
    setIsEditing(true);
    setActiveTab('actions');
  };

  const startEdit = (item: DataItem) => {
    setSelectedItem(item);
    setFormData({ ...item });
    setIsCreating(false);
    setIsEditing(true);
    setActiveTab('actions');
  };

  const handleDelete = async (item: DataItem) => {
    if (!confirm('Delete this item?')) return;
    try {
      const moduleKey = moduleName.toLowerCase();
      await (apiClient as any).deleteContent(moduleKey, item.id);
      await fetchData();
    } catch (e) {
      console.error('Delete failed', e);
      alert('Failed to delete');
    }
  };

  const validateForm = (): Record<string, string> => {
    const e: Record<string, string> = {};
    // Basic required check based on visible columns
    config.columns.forEach((c) => {
      if ((c.type === 'text' || c.type === 'number') && (formData[c.key] === undefined || formData[c.key] === '')) {
        // not strictly required; keep lenient
      }
    });
    return e;
  };

  const handleSave = async () => {
    const ve = validateForm();
    setErrors(ve);
    if (Object.keys(ve).length) return;
    try {
      const moduleKey = moduleName.toLowerCase();
      if (isCreating) {
        const res: any = await (apiClient as any).createContent(moduleKey, formData);
        if (res?.data) setFormData(res.data);
      } else if (selectedItem) {
        const res: any = await (apiClient as any).updateContent(moduleKey, selectedItem.id as any, formData);
        if (res?.data) setFormData(res.data);
      }
      setIsEditing(false);
      setIsCreating(false);
      setSelectedItem(null);
      await fetchData();
      setActiveTab('browse');
    } catch (e) {
      console.error('Save failed', e);
      alert('Failed to save');
    }
  };

  const renderFormField = (column: ModuleConfig['columns'][0]) => {
    const value = formData[column.key] ?? '';
    switch (column.type) {
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setFormData({ ...formData, [column.key]: e.target.value === '' ? '' : Number(e.target.value) })}
          />
        );
      case 'date':
        return (
          <Input type="date" value={value} onChange={(e) => setFormData({ ...formData, [column.key]: e.target.value })} />
        );
      case 'badge':
      case 'text':
      default:
        return (
          <Input type="text" value={value} onChange={(e) => setFormData({ ...formData, [column.key]: e.target.value })} />
        );
    }
  };

  if (!isOpen || !config) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{config.title}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              {!manageOnly && <TabsTrigger value="browse">Browse Data</TabsTrigger>}
              {!manageOnly && <TabsTrigger value="search">Search & Filter</TabsTrigger>}
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            {!manageOnly && (
            <TabsContent value="browse" className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-4 mb-4 flex-shrink-0">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder={`Search ${config.searchFields.join(', ')}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={fetchData} disabled={isLoading} size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading data...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-auto max-h-[60vh]">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b">
                          {config.columns.map((column) => (
                            <th
                              key={column.key}
                              className="text-left p-3 font-semibold text-sm bg-white"
                              style={{ width: column.width }}
                            >
                              {column.label}
                            </th>
                          ))}
                          <th className="text-left p-3 font-semibold text-sm w-32 bg-white">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getCurrentRows().map((item, index) => (
                          <tr key={item.id || index} className="border-b hover:bg-gray-50">
                            {config.columns.map((column) => (
                              <td key={column.key} className="p-3 text-sm">
                                {renderCell(item, column)}
                              </td>
                            ))}
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(item)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredData.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No data found
                    </div>
                  )}

                  {filteredData.length > 0 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t flex-shrink-0">
                      <div className="text-sm text-gray-600">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Previous
                        </Button>
                        
                        <div className="flex items-center gap-1">
                          <span className="px-3 py-1 text-sm">
                            Page {currentPage} of {totalPages}
                          </span>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            )}

            {!manageOnly && (
            <TabsContent value="search" className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Search & Filter</h3>
                  <p className="text-gray-600 text-sm">Use the filters below to narrow down your search results.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {config.filters?.map((filter) => (
                    <div key={filter.key}>
                      <label className="block text-sm font-medium mb-2">{filter.label}</label>
                      <Select
                        value={selectedFilters[filter.key] || ''}
                        onValueChange={(value) => handleFilterChange(filter.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${filter.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {filter.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setSelectedFilters({})} variant="outline">
                    Clear Filters
                  </Button>
                  <Button onClick={applyFilters}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </TabsContent>
            )}

            <TabsContent value="actions" className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Manage Content</h3>
                {!isEditing && (
                  <Button size="sm" onClick={startCreate}>Add New</Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.columns.map((c) => (
                      <div key={c.key} className="space-y-2">
                        <label className="block text-sm font-medium">{c.label}</label>
                        {renderFormField(c)}
                        {errors[c.key] && (
                          <p className="text-xs text-red-500">{errors[c.key]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave}>Save</Button>
                    <Button variant="outline" onClick={() => { setIsEditing(false); setIsCreating(false); setSelectedItem(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-auto max-h-[60vh]">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b">
                          {config.columns.map((column) => (
                            <th
                              key={column.key}
                              className="text-left p-3 font-semibold text-sm bg-white"
                              style={{ width: column.width }}
                            >
                              {column.label}
                            </th>
                          ))}
                          <th className="text-left p-3 font-semibold text-sm w-32 bg-white">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getCurrentRows().map((item, index) => (
                          <tr key={item.id || index} className="border-b hover:bg-gray-50">
                            {config.columns.map((column) => (
                              <td key={column.key} className="p-3 text-sm">
                                {renderCell(item, column)}
                              </td>
                            ))}
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(item)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredData.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No data found
                    </div>
                  )}

                  {filteredData.length > 0 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t flex-shrink-0">
                      <div className="text-sm text-gray-600">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Previous
                        </Button>
                        <span className="px-3 py-1 text-sm">Page {currentPage} of {totalPages}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
