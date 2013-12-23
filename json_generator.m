function json_generator()
%JSON_GENERATOR reads in new B-files and appends them to a JSON file
%
%	Written by: Michael Hutchins

delay = 600; %seconds
maxStrokes = 5000; %strokes
bPath = '/flash4/lightning/';
jsonPath ='data/';

jsonName = 'current';

jsonFile = sprintf('%s%s',jsonPath,jsonName);

data = [];

oldTime = datevec(now + 8/24 - delay/86400);
oldTime(6) = 0;

errorIndex = 0;

while true
	
	javaUTC = java.lang.System.currentTimeMillis;
	
	utcTime = [1970, 1, 1, 0, 0, javaUTC/1000 - delay];
	newTime = datevec(datenum(utcTime));
	newTime(6) = 0;
	
	if datenum(oldTime) < datenum(newTime)
		
		bFile = sprintf('%sB%04g%02g%02g%02g%02g.loc',...
			bPath,newTime(1:5));
		
		try
			newData = a_import(bFile);
		
			newData(:,11) = 1e7 * rand(size(newData,1),1);

			data = [data;newData];

			if size(data,1) > maxStrokes + 1
				data = data(end - maxStrokes : end,:);
			end

			loc2json(data(:,1:end-1),data(:,end),jsonFile);

			errorIndex = 0;
			
		catch
			
			fprintf('File %s Load Failed\n',bFile);
			
			errorIndex = errorIndex + 1;
			
		end
			
		if errorIndex == 0 || errorIndex > 4;
			oldTime = newTime;
		end

	end
	
	pause(15);
	
end

end
