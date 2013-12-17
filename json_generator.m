function json_generator()
%JSON_GENERATOR reads in new B-files and appends them to a JSON file
%
%	Written by: Michael Hutchins

bPath = '/flash4/lightning/';
jsonPath ='data/';

jsonName = 'current';

jsonFile = sprintf('%s%s',jsonPath,jsonName);

data = [];

oldTime = datevec(now);
oldTime(6) = 0;

while true
	
	newTime = datevec(now);
	newTime(6) = 0;
	
	if datenum(oldTime) < datenum(newTime)
		
		bFile = sprintf('%sB%04g%02g%02g%02g%02g.loc',...
			bPath,newTime(1:5));
		
		newData = a_import(bFile);
		
		data = [data;newData];
		
		if size(data,1) > 1000
			data = data(end - 999 : end,:);
		end
		
		loc2json(data,jsonFile);
		
		oldTime = newTime;
		
	end
	
	pause(15);
	
end

