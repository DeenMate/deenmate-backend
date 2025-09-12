'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { 
  Save, 
  X, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search, 
  Filter,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface DataEditorProps {
  moduleName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
}

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select' | 'boolean' | 'date';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  validation?: (value: any) => string | null;
}

const moduleFieldConfigs: Record<string, FieldConfig[]> = {
  quran: [
    { key: 'chapterNumber', label: 'Chapter Number', type: 'number', required: true },
    { key: 'nameArabic', label: 'Arabic Name', type: 'text', required: true },
    { key: 'nameSimple', label: 'Simple Name', type: 'text' },
    { key: 'nameEnglish', label: 'English Name', type: 'text' },
    { key: 'nameBangla', label: 'Bangla Name', type: 'text' },
    { 
      key: 'revelationPlace', 
      label: 'Revelation Place', 
      type: 'select',
      options: [
        { value: 'makkah', label: 'Makkah' },
        { value: 'madinah', label: 'Madinah' }
      ]
    },
    { key: 'revelationOrder', label: 'Revelation Order', type: 'number' },
    { key: 'versesCount', label: 'Verses Count', type: 'number', required: true },
    { key: 'bismillahPre', label: 'Bismillah Pre', type: 'boolean' },
  ],
  prayer: [
    { key: 'city', label: 'City', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'locKey', label: 'Loc Key', type: 'text', required: true },
    { key: 'lat', label: 'Latitude', type: 'number', required: true },
    { key: 'lng', label: 'Longitude', type: 'number', required: true },
    { key: 'timezone', label: 'Timezone', type: 'text' },
    { key: 'elevation', label: 'Elevation', type: 'number' },
    { key: 'source', label: 'Source', type: 'text' },
  ],
  'prayer times': [
    { key: 'city', label: 'City', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'locKey', label: 'Loc Key', type: 'text', required: true },
    { key: 'lat', label: 'Latitude', type: 'number', required: true },
    { key: 'lng', label: 'Longitude', type: 'number', required: true },
    { key: 'timezone', label: 'Timezone', type: 'text' },
    { key: 'elevation', label: 'Elevation', type: 'number' },
    { key: 'source', label: 'Source', type: 'text' },
  ],
  hadith: [
    { key: 'name', label: 'Collection Name', type: 'text', required: true },
    { key: 'titleEn', label: 'Title (EN)', type: 'text' },
    { key: 'totalHadith', label: 'Total Hadiths', type: 'number' },
    { key: 'hasBooks', label: 'Has Books', type: 'boolean' },
    { key: 'lastSyncedAt', label: 'Last Synced', type: 'date' },
  ],
  finance: [
    { key: 'metal', label: 'Metal', type: 'text' },
    { key: 'category', label: 'Category', type: 'text' },
    { key: 'price', label: 'Price', type: 'number' },
    { key: 'unit', label: 'Unit', type: 'text' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'change', label: 'Change', type: 'text' },
    { key: 'fetchedAt', label: 'Fetched At', type: 'date' },
    { key: 'source', label: 'Source', type: 'text' },
  ],
  audio: [
    { key: 'name', label: 'Reciter Name', type: 'text', required: true },
    { key: 'englishName', label: 'English Name', type: 'text' },
    { key: 'languageName', label: 'Language', type: 'text' },
    { key: 'style', label: 'Style', type: 'text' },
    { key: 'qirat', label: 'Qirāʼah', type: 'text' },
    { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
};

export function DataEditor({ moduleName, isOpen, onClose, onSave }: DataEditorProps) {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('browse');
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fieldConfigs = moduleFieldConfigs[moduleName.toLowerCase()] || [];
  const itemsPerPage = 20;
  const storageKey = `dm:columns:${moduleName.toLowerCase()}`;
  const sortStorageKey = `dm:sort:${moduleName.toLowerCase()}`;

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      fetchData();
    }
  }, [isOpen, moduleName]);

  // Refetch when page or search changes
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [currentPage, searchTerm]);

  // Load persisted column visibility and sort
  useEffect(() => {
    if (!isOpen) return;
    try {
      const savedCols = localStorage.getItem(storageKey);
      if (savedCols) setVisibleColumns(JSON.parse(savedCols));
      else setVisibleColumns(fieldConfigs.map(f => f.key));

      const savedSort = localStorage.getItem(sortStorageKey);
      if (savedSort) {
        const { by, order } = JSON.parse(savedSort);
        if (by) setSortBy(by);
        if (order) setSortOrder(order);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, moduleName]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Check if module is supported by content management API
    const supportedModules = ['quran', 'hadith', 'audio', 'finance', 'prayer', 'prayer times'];
    const moduleKey = moduleName.toLowerCase();
    const moduleMap: Record<string, string> = {
      'prayer times': 'prayer',
    };
    const apiModule = moduleMap[moduleKey] || moduleKey;
    
    if (!supportedModules.includes(moduleKey)) {
      // Use mock data for unsupported modules
      console.log(`Module ${moduleName} is not supported by content management API, using mock data`);
      const mockData = generateMockData(moduleName);
      setData(mockData);
      setFilteredData(mockData);
      setTotalCount(mockData.length);
      setTotalPages(Math.max(1, Math.ceil(mockData.length / itemsPerPage)));
      setIsLoading(false);
      return;
    }
    
    try {
      const params: any = { page: currentPage, limit: itemsPerPage };
      if (searchTerm) params.search = searchTerm;
      const response: any = await apiClient.getContent(apiModule, params);
      const items = Array.isArray(response.data) ? response.data : (response.data ? [response.data] : []);
      // client-side sort for now (API may support sort later)
      const sorted = sortBy
        ? [...items].sort((a, b) => {
            const av = a[sortBy];
            const bv = b[sortBy];
            if (av === bv) return 0;
            const cmp = av > bv ? 1 : -1;
            return sortOrder === 'asc' ? cmp : -cmp;
          })
        : items;
      setData(sorted);
      setFilteredData(items);
      const totalFromApi =
        (response.pagination && (response.pagination.total || response.pagination.total_count)) ??
        (typeof response.total === 'number' ? response.total : undefined) ??
        (typeof response.count === 'number' ? response.count : undefined) ??
        items.length;
      setTotalCount(Number(totalFromApi || 0));
      setTotalPages(Math.max(1, Math.ceil(Number(totalFromApi || 0) / itemsPerPage)));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Fallback to mock data if API fails
      const mockData = generateMockData(moduleName);
      setData(mockData);
      setFilteredData(mockData);
      setTotalCount(mockData.length);
      setTotalPages(Math.max(1, Math.ceil(mockData.length / itemsPerPage)));
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = (module: string): any[] => {
    switch (module.toLowerCase()) {
      case 'quran':
        return [
          { id: 1, chapterNumber: 1, nameArabic: 'الفاتحة', nameSimple: 'Al-Fatihah', nameEnglish: 'The Opening', versesCount: 7, revelationPlace: 'makkah' },
          { id: 2, chapterNumber: 2, nameArabic: 'البقرة', nameSimple: 'Al-Baqarah', nameEnglish: 'The Cow', versesCount: 286, revelationPlace: 'madinah' },
        ];
      case 'hadith':
        return [
          { id: 1, name: 'Sahih al-Bukhari', totalAvailableHadith: 7563, totalAvailableBooks: 97, language: 'en' },
          { id: 2, name: 'Sahih Muslim', totalAvailableHadith: 7563, totalAvailableBooks: 43, language: 'en' },
        ];
      case 'finance':
        return [
          { id: 1, productName: '22K Gold', category: '22K', price: 85000, unit: 'Gram', metal: 'Gold' },
          { id: 2, productName: 'Traditional Gold', category: 'TRADITIONAL', price: 82000, unit: 'Gram', metal: 'Gold' },
        ];
      case 'audio':
        return [
          { id: 1, name: 'Abdul Rahman Al-Sudais', language: 'ar', style: 'Tajweed', format: 'MP3' },
          { id: 2, name: 'Mishary Rashid Alafasy', language: 'ar', style: 'Modern', format: 'MP3' },
        ];
      case 'prayer':
      case 'prayer times':
        return [
          { id: 1, name: 'Dhaka, Bangladesh', latitude: 23.8103, longitude: 90.4125, timezone: 'Asia/Dhaka', method: 'Muslim World League' },
          { id: 2, name: 'Mecca, Saudi Arabia', latitude: 21.3891, longitude: 39.8579, timezone: 'Asia/Riyadh', method: 'Umm al-Qura' },
          { id: 3, name: 'London, UK', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', method: 'Muslim World League' },
          { id: 4, name: 'New York, USA', latitude: 40.7128, longitude: -74.0060, timezone: 'America/New_York', method: 'Islamic Society of North America' },
        ];
      case 'zakat':
        return [
          { id: 1, category: 'Gold', nisab: 87.48, unit: 'grams', rate: '2.5%', description: 'Gold and silver jewelry, coins, and bullion' },
          { id: 2, category: 'Silver', nisab: 612.36, unit: 'grams', rate: '2.5%', description: 'Silver jewelry, coins, and bullion' },
          { id: 3, category: 'Cash', nisab: 'Current gold price × 87.48g', unit: 'local currency', rate: '2.5%', description: 'Cash, bank deposits, and liquid assets' },
          { id: 4, category: 'Business Assets', nisab: 'Current gold price × 87.48g', unit: 'local currency', rate: '2.5%', description: 'Inventory, equipment, and business investments' },
        ];
      default:
        return [];
    }
  };

  const applyFilters = () => {
    // For server-side pagination we already receive a page slice
    setFilteredData(data);
  };

  const handleEdit = (item: any) => {
    setSelectedItem(item);
    setFormData({ ...item });
    setIsEditing(true);
    setActiveTab('edit');
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setFormData({});
    setIsCreating(true);
    setActiveTab('edit');
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      if (isCreating) {
        // Create new item via API
        const response = await apiClient.createContent(moduleName.toLowerCase(), formData);
        setData([response.data, ...data]);
        onSave?.(response.data);
      } else {
        // Update existing item via API
        const response = await apiClient.updateContent(moduleName.toLowerCase(), selectedItem.id, formData);
        const updatedData = data.map(item =>
          item.id === selectedItem.id ? response.data : item
        );
        setData(updatedData);
        onSave?.(response.data);
      }

      setIsEditing(false);
      setIsCreating(false);
      setActiveTab('browse');
      setErrors({});
    } catch (error) {
      console.error('Failed to save data:', error);
      setErrors({ general: 'Failed to save data. Please try again.' });
    }
  };

  const handleDelete = async (item: any) => {
    if (confirm(`Are you sure you want to delete this ${moduleName} item?`)) {
      try {
        await apiClient.deleteContent(moduleName.toLowerCase(), item.id);
        const updatedData = data.filter(d => d.id !== item.id);
        setData(updatedData);
      } catch (error) {
        console.error('Failed to delete data:', error);
        alert('Failed to delete item. Please try again.');
      }
    }
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    fieldConfigs.forEach(field => {
      const value = formData[field.key];
      
      if (field.required && (!value || value === '')) {
        errors[field.key] = `${field.label} is required`;
      }

      if (field.validation) {
        const validationError = field.validation(value);
        if (validationError) {
          errors[field.key] = validationError;
        }
      }
    });

    return errors;
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key] || '';
    const error = errors[field.key];

    switch (field.type) {
      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(newValue) => setFormData({ ...formData, [field.key]: newValue })}
          >
            <SelectTrigger className={error ? 'border-red-500' : ''}>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            placeholder={field.placeholder}
            className={`w-full p-2 border rounded-md ${error ? 'border-red-500' : ''}`}
            rows={3}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );

      default:
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              setFormData({ ...formData, [field.key]: v });
              // inline validation
              setErrors(prev => {
                const n = { ...prev };
                if (field.required && (!v || v === '')) n[field.key] = `${field.label} is required`;
                else if (field.validation) {
                  const ve = field.validation(v);
                  if (ve) n[field.key] = ve; else delete n[field.key];
                } else delete n[field.key];
                return n;
              });
            }}
            placeholder={field.placeholder}
            className={error ? 'border-red-500' : ''}
          />
        );
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const set = new Set(prev.length ? prev : fieldConfigs.map(f => f.key));
      if (set.has(key)) set.delete(key); else set.add(key);
      const arr = Array.from(set);
      localStorage.setItem(storageKey, JSON.stringify(arr));
      return arr;
    });
  };

  const onHeaderClick = (key: string) => {
    const newOrder: 'asc' | 'desc' = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(key);
    setSortOrder(newOrder);
    localStorage.setItem(sortStorageKey, JSON.stringify({ by: key, order: newOrder }));
    // sort current data slice
    setData(prev => {
      const sorted = [...prev].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return newOrder === 'asc' ? cmp : -cmp;
      });
      return sorted;
    });
  };

  const downloadTemplate = () => {
    const headers = fieldConfigs.map(f => f.key);
    const sample = fieldConfigs.map(f => {
      switch (f.type) {
        case 'number': return '0';
        case 'boolean': return 'true';
        default: return f.key;
      }
    });
    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleName.toLowerCase()}_template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{moduleName} Content Management</CardTitle>
              <CardDescription>Browse, edit, and manage {moduleName} data</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="browse">Browse</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-4 mb-4 flex-shrink-0 relative">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search data..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={() => setShowColumnsMenu(v => !v)}>Columns</Button>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>

                {showColumnsMenu && (
                  <div className="absolute right-0 top-12 z-20 bg-white border rounded shadow p-3 w-56">
                    <p className="text-xs text-gray-500 mb-2">Visible columns</p>
                    <div className="space-y-2 max-h-56 overflow-auto">
                      {fieldConfigs.map(fc => (
                        <label key={fc.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={(visibleColumns.length ? visibleColumns : fieldConfigs.map(f=>f.key)).includes(fc.key)}
                            onChange={() => toggleColumn(fc.key)}
                          />
                          {fc.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto max-h-[60vh]">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b">
                      {fieldConfigs.filter(f => (visibleColumns.length ? visibleColumns.includes(f.key) : true)).map((field) => (
                        <th
                          key={field.key}
                          className="text-left p-3 font-semibold bg-white cursor-pointer select-none"
                          onClick={() => onHeaderClick(field.key)}
                          title="Click to sort"
                        >
                          {field.label}
                          {sortBy === field.key && (
                            <span className="ml-1 text-xs text-gray-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </th>
                      ))}
                      <th className="text-left p-3 font-semibold w-32 bg-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        {fieldConfigs.filter(f => (visibleColumns.length ? visibleColumns.includes(f.key) : true)).map((field) => (
                          <td key={field.key} className="p-3 text-sm">
                            {field.type === 'boolean' ? (
                              <Badge variant={item[field.key] ? 'default' : 'secondary'}>
                                {item[field.key] ? 'Yes' : 'No'}
                              </Badge>
                            ) : (
                              item[field.key] || 'N/A'
                            )}
                          </td>
                        ))}
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
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
            </TabsContent>

            <TabsContent value="edit" className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {isCreating ? 'Create New' : 'Edit'} {moduleName} Item
                  </h3>
                  <div className="flex gap-2">
                    <Button onClick={handleSave}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setIsCreating(false);
                      setActiveTab('browse');
                      setErrors({});
                    }}>
                      Cancel
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fieldConfigs.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="block text-sm font-medium">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {renderField(field)}
                      {errors[field.key] && (
                        <p className="text-sm text-red-500 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {errors[field.key]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="import" className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Import Data</h3>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Upload File</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 mb-2">Drag and drop your file here, or click to browse</p>
                      <p className="text-sm text-gray-500">Supported formats: CSV, JSON, Excel</p>
                      <Button className="mt-4" variant="outline">
                        Choose File
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="export" className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Export Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">CSV Export</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-3">Export data as CSV file</p>
                      <Button variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">JSON Export</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-3">Export data as JSON file</p>
                      <Button variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Export JSON
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Excel Export</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-3">Export data as Excel file</p>
                      <Button variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
